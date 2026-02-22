import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "COMPLETION_P95_MS",
  "NEARBY_P95_MS",
  "OFFLINE_SYNC_SLA_PCT",
  "CRASH_FREE_SESSIONS_PCT",
];

const THRESHOLDS = {
  completionP95Ms: 2000,
  nearbyP95Ms: 800,
  offlineSyncSlaPct: 99,
  crashFreeSessionsPct: 99.5,
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function asNumber(name) {
  const value = Number(requireEnv(name));
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

async function loadAcceptedCompletions(supabase) {
  const { data, error } = await supabase
    .from("quest_completions")
    .select("user_id, device_event_id")
    .eq("status", "accepted")
    .limit(10000);

  if (error) {
    throw new Error(`Failed loading quest completions: ${error.message}`);
  }

  return data ?? [];
}

function countDuplicates(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = `${row.user_id}:${row.device_event_id}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
  }
  return duplicates;
}

async function main() {
  for (const key of REQUIRED_ENV) {
    requireEnv(key);
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const [acceptedRows] = await Promise.all([loadAcceptedCompletions(supabase)]);
  const duplicateAccepted = countDuplicates(acceptedRows);

  const metrics = {
    completionP95Ms: asNumber("COMPLETION_P95_MS"),
    nearbyP95Ms: asNumber("NEARBY_P95_MS"),
    offlineSyncSlaPct: asNumber("OFFLINE_SYNC_SLA_PCT"),
    crashFreeSessionsPct: asNumber("CRASH_FREE_SESSIONS_PCT"),
    duplicateAccepted,
  };

  const failures = [];
  if (metrics.completionP95Ms >= THRESHOLDS.completionP95Ms) {
    failures.push(
      `completion p95 ${metrics.completionP95Ms}ms >= ${THRESHOLDS.completionP95Ms}ms`,
    );
  }
  if (metrics.nearbyP95Ms >= THRESHOLDS.nearbyP95Ms) {
    failures.push(`nearby p95 ${metrics.nearbyP95Ms}ms >= ${THRESHOLDS.nearbyP95Ms}ms`);
  }
  if (metrics.offlineSyncSlaPct < THRESHOLDS.offlineSyncSlaPct) {
    failures.push(
      `offline sync SLA ${metrics.offlineSyncSlaPct}% < ${THRESHOLDS.offlineSyncSlaPct}%`,
    );
  }
  if (metrics.crashFreeSessionsPct < THRESHOLDS.crashFreeSessionsPct) {
    failures.push(
      `crash-free sessions ${metrics.crashFreeSessionsPct}% < ${THRESHOLDS.crashFreeSessionsPct}%`,
    );
  }
  if (metrics.duplicateAccepted !== 0) {
    failures.push(`duplicate accepted completions ${metrics.duplicateAccepted} (must be 0)`);
  }

  console.log(JSON.stringify({ metrics, failures }, null, 2));

  if (failures.length > 0) {
    throw new Error(`Staging gate failed: ${failures.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(`[staging:gate:check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
