import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
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

async function main() {
  assert(Boolean(publishableKey), "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required");

  const supabase = createClient(supabaseUrl, publishableKey);
  const signIn = await supabase.auth.signInAnonymously();
  assert(!signIn.error, `Anonymous sign-in failed: ${signIn.error?.message ?? "unknown"}`);
  const token = signIn.data.session?.access_token;
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
