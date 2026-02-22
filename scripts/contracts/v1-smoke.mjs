import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBaseUrl =
  process.env.API_BASE_URL ?? `${supabaseUrl}/functions/v1/v1`;
const cityId = process.env.CITY_ID ?? "blr";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function http(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return { response, json, text };
}

function createServiceRoleClient() {
  if (!serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function generateSmokeCredentials() {
  const entropy = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    email: `ci_smoke_${entropy}@example.com`,
    password: `PQ_ci_${entropy}_A9`,
  };
}

async function issueSmokeAccessToken(supabase) {
  const anonymousSignIn = await supabase.auth.signInAnonymously();
  const anonymousToken = anonymousSignIn.data.session?.access_token;

  if (!anonymousSignIn.error && anonymousToken) {
    return { token: anonymousToken, strategy: "anonymous" };
  }

  const fallbackEmail = process.env.SMOKE_TEST_EMAIL;
  const fallbackPassword = process.env.SMOKE_TEST_PASSWORD;

  if (fallbackEmail && fallbackPassword) {
    const passwordSignIn = await supabase.auth.signInWithPassword({
      email: fallbackEmail,
      password: fallbackPassword,
    });
    if (!passwordSignIn.error && passwordSignIn.data.session?.access_token) {
      return {
        token: passwordSignIn.data.session.access_token,
        strategy: "smoke_test_credentials",
      };
    }
  }

  const anonymousErrorMessage = anonymousSignIn.error?.message ?? "";
  const anonymousDisabled = /anonymous sign-ins are disabled/i.test(
    anonymousErrorMessage,
  );

  if (!anonymousDisabled) {
    throw new Error(`Anonymous sign-in failed: ${anonymousErrorMessage || "unknown"}`);
  }

  const adminSupabase = createServiceRoleClient();
  let adminProvisionError = "";
  if (adminSupabase) {
    const serviceRoleCreds = generateSmokeCredentials();
    const createUser = await adminSupabase.auth.admin.createUser({
      email: serviceRoleCreds.email,
      password: serviceRoleCreds.password,
      email_confirm: true,
      user_metadata: { source: "ci_smoke" },
    });

    if (!createUser.error) {
      const serviceRoleSignIn = await supabase.auth.signInWithPassword({
        email: serviceRoleCreds.email,
        password: serviceRoleCreds.password,
      });
      if (!serviceRoleSignIn.error && serviceRoleSignIn.data.session?.access_token) {
        return {
          token: serviceRoleSignIn.data.session.access_token,
          strategy: "service_role_ephemeral_user",
        };
      }

      adminProvisionError =
        `serviceRoleSignIn=${serviceRoleSignIn.error?.message ?? "unknown"}`;
    } else {
      adminProvisionError = `serviceRoleCreateUser=${createUser.error.message}`;
    }
  }

  const { email, password } = generateSmokeCredentials();

  const passwordSignUp = await supabase.auth.signUp({
    email,
    password,
  });

  if (!passwordSignUp.error && passwordSignUp.data.session?.access_token) {
    return passwordSignUp.data.session.access_token;
  }

  const passwordSignIn = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!passwordSignIn.error && passwordSignIn.data.session?.access_token) {
    return {
      token: passwordSignIn.data.session.access_token,
      strategy: "signup_signin_fallback",
    };
  }

  throw new Error(
    [
      "Anonymous auth disabled and fallback password sign-in failed.",
      adminProvisionError,
      `signUp=${passwordSignUp.error?.message ?? "unknown"}`,
      `signIn=${passwordSignIn.error?.message ?? "unknown"}`,
      "Set SMOKE_TEST_EMAIL/SMOKE_TEST_PASSWORD or SUPABASE_SERVICE_ROLE_KEY if needed.",
    ].join(" "),
  );
}

async function main() {
  assert(Boolean(publishableKey), "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required");

  const supabase = createClient(supabaseUrl, publishableKey);
  const authResult = await issueSmokeAccessToken(supabase);
  const token = authResult.token;
  assert(typeof token === "string", "No access token returned from auth");

  const health = await http("/health", token);
  assert(health.response.status === 200, `Health check failed: ${health.response.status} ${health.text}`);
  assert(health.response.headers.get("x-request-id"), "Missing response header: x-request-id");
  assert(health.response.headers.get("x-release-sha"), "Missing response header: x-release-sha");
  assert(health.json?.status === "ok", "Health response.status must be ok");
  assert(typeof health.json?.environment === "string", "Health response.environment is required");
  assert(typeof health.json?.releaseSha === "string", "Health response.releaseSha is required");
  assert(typeof health.json?.serverTime === "string", "Health response.serverTime is required");

  const bootstrap = await http(`/config/bootstrap?cityId=${encodeURIComponent(cityId)}`, token);
  assert(
    bootstrap.response.status === 200,
    `Bootstrap check failed: ${bootstrap.response.status} ${bootstrap.text}`,
  );
  assert(bootstrap.json?.cityId === cityId, "Bootstrap cityId mismatch");
  assert(bootstrap.json?.notificationPolicy, "Bootstrap notificationPolicy missing");

  const summary = await http("/users/me/summary", token);
  assert(summary.response.status === 200, `Summary check failed: ${summary.response.status} ${summary.text}`);
  assert(typeof summary.json?.user?.id === "string", "Summary user.id missing");
  assert(typeof summary.json?.stats?.level === "number", "Summary stats.level missing");

  console.log(
    JSON.stringify(
      {
        ok: true,
        authStrategy: authResult.strategy,
        apiBaseUrl,
        cityId,
        health: {
          environment: health.json.environment,
          releaseSha: health.json.releaseSha,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`[contracts:v1-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
