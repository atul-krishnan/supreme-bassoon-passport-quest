#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const syncGithubSecrets = parseBoolean(
  process.env.SYNC_GITHUB_SECRETS,
  true,
);
const verifyPasswordLogin = parseBoolean(
  process.env.SMOKE_VERIFY_PASSWORD_LOGIN,
  true,
);
const target = (process.env.SMOKE_TARGET ?? "all").toLowerCase();

const environments = [
  {
    name: "staging",
    prefix: "STAGING",
    defaultEmail: "smoke-staging@passportquest.app",
  },
  {
    name: "production",
    prefix: "PROD",
    defaultEmail: "smoke-prod@passportquest.app",
  },
];

function parseBoolean(raw, fallback) {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function redactKey(value) {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function generatePassword() {
  const token = randomBytes(18).toString("base64url");
  return `PQ_smoke_${token}_A9!`;
}

function shouldIncludeEnvironment(name) {
  if (target === "all") {
    return true;
  }
  if (target === "staging") {
    return name === "staging";
  }
  if (target === "production" || target === "prod") {
    return name === "production";
  }

  throw new Error(
    `Invalid SMOKE_TARGET=${target}. Use one of: all, staging, production`,
  );
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let body = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }
  }

  return { response, body, bodyText };
}

async function adminRequest(config, path, method = "GET", payload) {
  const url = `${config.supabaseUrl}/auth/v1/admin${path}`;
  const { response, body, bodyText } = await requestJson(url, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `${config.name}: admin ${method} ${path} failed (${response.status}) ${bodyText}`,
    );
  }

  return body;
}

async function findUserByEmail(config, email) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const result = await adminRequest(
      config,
      `/users?page=${page}&per_page=100`,
      "GET",
    );

    const users = Array.isArray(result?.users)
      ? result.users
      : Array.isArray(result)
        ? result
        : [];

    const match = users.find(
      (user) => String(user?.email ?? "").trim().toLowerCase() === normalizedEmail,
    );
    if (match) {
      return match;
    }

    if (users.length < 100) {
      break;
    }
  }

  return null;
}

async function createUser(config, email, password) {
  return adminRequest(config, "/users", "POST", {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      source: "ci_smoke",
      environment: config.name,
    },
  });
}

async function updateUserPassword(config, userId, password) {
  return adminRequest(config, `/users/${userId}`, "PUT", {
    password,
    email_confirm: true,
    user_metadata: {
      source: "ci_smoke",
      environment: config.name,
    },
  });
}

async function verifyPasswordSignIn(config, email, password) {
  const apiKey = config.publishableKey || config.serviceRoleKey;
  const { response, body, bodyText } = await requestJson(
    `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );

  if (!response.ok) {
    const errorCode = String(body?.error_code ?? "");
    if (errorCode === "email_provider_disabled") {
      throw new Error(
        `${config.name}: email/password auth is disabled in Supabase Auth. Enable Email provider before using dedicated smoke credentials.`,
      );
    }
    throw new Error(
      `${config.name}: password sign-in verification failed (${response.status}) ${bodyText}`,
    );
  }
}

function ensureGhCliReady() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "SYNC_GITHUB_SECRETS=true but gh auth is not ready. Run `gh auth login`, or set SYNC_GITHUB_SECRETS=false.",
    );
  }
}

function setGithubSecret(name, value) {
  execFileSync("gh", ["secret", "set", name, "--body", value], {
    stdio: "ignore",
  });
}

function readEnvConfig(definition) {
  const prefix = definition.prefix;
  const supabaseUrlRaw = process.env[`${prefix}_SUPABASE_URL`];
  const serviceRoleKeyRaw = process.env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
  const publishableKeyRaw = process.env[`${prefix}_SUPABASE_PUBLISHABLE_KEY`];
  const emailRaw = process.env[`${prefix}_SMOKE_TEST_EMAIL`];
  const passwordRaw = process.env[`${prefix}_SMOKE_TEST_PASSWORD`];

  const supabaseUrl = supabaseUrlRaw ? supabaseUrlRaw.trim().replace(/\/$/, "") : "";
  const serviceRoleKey = serviceRoleKeyRaw ? serviceRoleKeyRaw.trim() : "";
  const publishableKey = publishableKeyRaw ? publishableKeyRaw.trim() : "";
  const email = emailRaw ? emailRaw.trim() : definition.defaultEmail;
  let password = passwordRaw ? passwordRaw.trim() : "";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  let passwordGenerated = false;
  if (!password) {
    if (!syncGithubSecrets) {
      throw new Error(
        `${definition.name}: ${prefix}_SMOKE_TEST_PASSWORD is required when SYNC_GITHUB_SECRETS=false`,
      );
    }
    password = generatePassword();
    passwordGenerated = true;
  }

  return {
    name: definition.name,
    prefix,
    supabaseUrl,
    serviceRoleKey,
    publishableKey,
    email,
    password,
    passwordGenerated,
  };
}

async function upsertSmokeUser(config) {
  const existing = await findUserByEmail(config, config.email);
  if (existing?.id) {
    await updateUserPassword(config, existing.id, config.password);
    return { action: "updated", userId: existing.id };
  }

  const created = await createUser(config, config.email, config.password);
  const createdId = created?.id || created?.user?.id || "unknown";
  return { action: "created", userId: createdId };
}

async function run() {
  const selected = environments.filter((env) =>
    shouldIncludeEnvironment(env.name),
  );
  assert(selected.length > 0, "No environments selected.");

  if (syncGithubSecrets) {
    ensureGhCliReady();
  }

  const configs = selected
    .map((definition) => readEnvConfig(definition))
    .filter(Boolean);

  if (configs.length === 0) {
    throw new Error(
      "No target environments are configured. Provide *_SUPABASE_URL and *_SUPABASE_SERVICE_ROLE_KEY for staging/production.",
    );
  }

  for (const config of configs) {
    const result = await upsertSmokeUser(config);
    if (verifyPasswordLogin) {
      await verifyPasswordSignIn(config, config.email, config.password);
    }

    if (syncGithubSecrets) {
      setGithubSecret(`${config.prefix}_SMOKE_TEST_EMAIL`, config.email);
      setGithubSecret(`${config.prefix}_SMOKE_TEST_PASSWORD`, config.password);
    }

    console.log(
      [
        `[smoke-user-setup] ${config.name}: ${result.action}`,
        `userId=${result.userId}`,
        `email=${config.email}`,
        `password=${config.passwordGenerated ? "generated" : "provided"}`,
        `serviceKey=${redactKey(config.serviceRoleKey)}`,
        `verifyPassword=${verifyPasswordLogin ? "enabled" : "skipped"}`,
        `ghSecrets=${syncGithubSecrets ? "updated" : "skipped"}`,
      ].join(" | "),
    );
  }

  console.log("[smoke-user-setup] completed");
}

run().catch((error) => {
  console.error(
    `[smoke-user-setup] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
