import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
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

function optionalNumber(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number when provided`);
  }
  return parsed;
}

function percentile(values, p) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index];
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

async function loadRouteP95(supabase, route, method, sinceIso) {
  const { data, error } = await supabase
    .from("api_request_metrics")
    .select("latency_ms")
    .eq("route", route)
    .eq("method", method)
    .gte("created_at", sinceIso)
    .lt("status_code", 500)
    .limit(20000);

  if (error) {
    if (/api_request_metrics/i.test(error.message) && /does not exist/i.test(error.message)) {
      return { samples: 0, p95: null };
    }
    throw new Error(`Failed loading api_request_metrics for ${method} ${route}: ${error.message}`);
  }

  const latencies = (data ?? [])
    .map((row) => Number(row.latency_ms))
    .filter((value) => Number.isFinite(value) && value >= 0);

  return {
    samples: latencies.length,
    p95: percentile(latencies, 0.95),
  };
}

function resolveLatencyMetric({
  metricName,
  autoMetric,
  fallbackEnvName,
  minSamples,
}) {
  if (typeof autoMetric.p95 === "number" && autoMetric.samples >= minSamples) {
    return {
      value: autoMetric.p95,
      source: "auto_db",
      samples: autoMetric.samples,
    };
  }

  const fallback = optionalNumber(fallbackEnvName);
  if (typeof fallback === "number") {
    return {
      value: fallback,
      source: "fallback_env",
      samples: autoMetric.samples,
    };
  }

  throw new Error(
    [
      `Missing ${metricName}.`,
      `Automated metric had ${autoMetric.samples} samples (min required: ${minSamples}).`,
      `Set ${fallbackEnvName} as fallback if staging volume is low.`,
    ].join(" "),
  );
}

async function main() {
  for (const key of REQUIRED_ENV) {
    requireEnv(key);
  }

  const autoMetricWindowHours = Math.max(
    1,
    Math.floor(optionalNumber("AUTO_METRIC_WINDOW_HOURS") ?? 24),
  );
  const minAutoSamples = Math.max(
    1,
    Math.floor(optionalNumber("AUTO_METRIC_MIN_SAMPLES") ?? 30),
  );
  const sinceIso = new Date(
    Date.now() - autoMetricWindowHours * 60 * 60 * 1000,
  ).toISOString();

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const [acceptedRows, completionAuto, nearbyAuto] = await Promise.all([
    loadAcceptedCompletions(supabase),
    loadRouteP95(supabase, "/quests/complete", "POST", sinceIso),
    loadRouteP95(supabase, "/quests/nearby", "GET", sinceIso),
  ]);

  const completionMetric = resolveLatencyMetric({
    metricName: "completion p95",
    autoMetric: completionAuto,
    fallbackEnvName: "COMPLETION_P95_MS",
    minSamples: minAutoSamples,
  });

  const nearbyMetric = resolveLatencyMetric({
    metricName: "nearby p95",
    autoMetric: nearbyAuto,
    fallbackEnvName: "NEARBY_P95_MS",
    minSamples: minAutoSamples,
  });

  const metrics = {
    completionP95Ms: completionMetric.value,
    nearbyP95Ms: nearbyMetric.value,
    offlineSyncSlaPct: asNumber("OFFLINE_SYNC_SLA_PCT"),
    crashFreeSessionsPct: asNumber("CRASH_FREE_SESSIONS_PCT"),
    duplicateAccepted: countDuplicates(acceptedRows),
  };

  const metricSources = {
    completionP95Ms: completionMetric.source,
    nearbyP95Ms: nearbyMetric.source,
    windowHours: autoMetricWindowHours,
    minSamples: minAutoSamples,
    completionSamples: completionMetric.samples,
    nearbySamples: nearbyMetric.samples,
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

  console.log(JSON.stringify({ metrics, metricSources, failures }, null, 2));

  if (failures.length > 0) {
    throw new Error(`Staging gate failed: ${failures.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(`[staging:gate:check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
