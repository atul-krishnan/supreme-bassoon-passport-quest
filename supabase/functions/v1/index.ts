import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireAuthUser } from "../_shared/auth.ts";

type DbClient = ReturnType<typeof createClient>;

const ALLOWED_CITY_IDS = new Set(["blr", "nyc"]);
const ALLOWED_FLOW_ENERGY_BASELINES = new Set(["low", "balanced", "high"]);
const ALLOWED_FLOW_FOCUS_PILLARS = new Set([
  "deep_work",
  "vitality_health",
  "local_discovery",
]);
const ALLOWED_FLOW_FRICTION_POINTS = new Set([
  "decision_paralysis",
  "procrastination",
]);
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;
const RELEASE_SHA = (Deno.env.get("RELEASE_SHA") ?? "dev-local").trim() || "dev-local";
const APP_ENV = (Deno.env.get("APP_ENV") ?? "local").trim() || "local";

function withMetaHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-release-sha", RELEASE_SHA);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function makeServiceClient(req: Request): DbClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  return createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function makeAdminServiceClient(): DbClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function logApiRequestMetric(
  adminDb: DbClient,
  payload: {
    requestId: string;
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    userId: string | null;
  },
) {
  const { error } = await adminDb.from("api_request_metrics").insert({
    request_id: payload.requestId,
    route: payload.route,
    method: payload.method,
    status_code: payload.statusCode,
    latency_ms: Math.max(0, Math.round(payload.latencyMs)),
    user_id: payload.userId,
    release_sha: RELEASE_SHA,
  });

  if (error) {
    console.error(`[api_request_metrics] ${error.message}`);
  }
}

function normalizeRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const v1Index = segments.lastIndexOf("v1");
  const routeSegments = v1Index >= 0 ? segments.slice(v1Index + 1) : segments;
  return `/${routeSegments.join("/")}`;
}

function parseCityId(searchParams: URLSearchParams): "blr" | "nyc" {
  const value = (searchParams.get("cityId") ?? "blr").toLowerCase();
  if (!ALLOWED_CITY_IDS.has(value)) {
    throw new Error("cityId must be one of: blr, nyc");
  }
  return value as "blr" | "nyc";
}

function parseCityIdFromValue(value: unknown): "blr" | "nyc" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_CITY_IDS.has(normalized)) {
    return null;
  }
  return normalized as "blr" | "nyc";
}

function sanitizeUsername(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function computeDeterministicControlAssignment(seed: string, controlPercent: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 100 < controlPercent ? "control" : "treatment";
}

function parseQuietHourHour(value: string) {
  const [hoursPart] = value.split(":");
  const parsed = Number(hoursPart);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return 0;
  }
  return parsed;
}

function isWithinQuietHours(
  now: Date,
  timeZone: string,
  quietHours: { startLocal: string; endLocal: string },
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  const localHour = Number(formatter.format(now));
  const startHour = parseQuietHourHour(quietHours.startLocal);
  const endHour = parseQuietHourHour(quietHours.endLocal);

  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return localHour >= startHour && localHour < endHour;
  }

  return localHour >= startHour || localHour < endHour;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw new Error("JSON body must be an object");
    }
    return body as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({
    status: "ok",
    environment: APP_ENV,
    releaseSha: RELEASE_SHA,
    serverTime: new Date().toISOString(),
  });
}

type FlowSessionRow = {
  session_id: string;
  play_id: string;
  recommendation_id: string | null;
  title: string;
  focus_pillar: string;
  status: string;
  current_step_order: number | null;
  started_at: string;
  completed_at: string | null;
  xp_reward: number;
  decision_minutes_saved: number;
  why: string;
  steps_json: unknown;
};

function normalizeFlowStepStatus(value: unknown): "pending" | "active" | "completed" {
  if (value === "active" || value === "completed") {
    return value;
  }
  return "pending";
}

function normalizeFlowSessionStatus(value: unknown): "in_progress" | "paused" | "completed" | "cancelled" {
  if (
    value === "in_progress" ||
    value === "paused" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "in_progress";
}

function parseFlowSteps(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      order: Number(item.order ?? 0),
      title: String(item.title ?? "Step"),
      instruction: String(item.instruction ?? ""),
      durationSec: Math.max(30, Number(item.durationSec ?? 60)),
      status: normalizeFlowStepStatus(item.status),
      startedAt:
        typeof item.startedAt === "string" && item.startedAt.length > 0
          ? item.startedAt
          : undefined,
      completedAt:
        typeof item.completedAt === "string" && item.completedAt.length > 0
          ? item.completedAt
          : undefined,
    }))
    .sort((a, b) => a.order - b.order);
}

function serializeFlowSession(row: FlowSessionRow) {
  const steps = parseFlowSteps(row.steps_json);
  return {
    sessionId: String(row.session_id),
    playId: String(row.play_id),
    recommendationId: row.recommendation_id ? String(row.recommendation_id) : undefined,
    title: String(row.title),
    focusPillar: String(row.focus_pillar),
    status: normalizeFlowSessionStatus(row.status),
    currentStepOrder:
      row.current_step_order === null || row.current_step_order === undefined
        ? null
        : Number(row.current_step_order),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    xpReward: Math.max(0, Number(row.xp_reward ?? 0)),
    decisionMinutesSaved: Math.max(0, Number(row.decision_minutes_saved ?? 0)),
    why: String(row.why ?? ""),
    steps,
  };
}

function normalizeFlowSessionPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (typeof row.sessionId === "string") {
    return {
      sessionId: row.sessionId,
      playId: String(row.playId ?? ""),
      recommendationId:
        typeof row.recommendationId === "string" ? row.recommendationId : undefined,
      title: String(row.title ?? ""),
      focusPillar: String(row.focusPillar ?? ""),
      status: normalizeFlowSessionStatus(row.status),
      currentStepOrder:
        row.currentStepOrder === null || row.currentStepOrder === undefined
          ? null
          : Number(row.currentStepOrder),
      startedAt: String(row.startedAt ?? ""),
      completedAt:
        typeof row.completedAt === "string" ? row.completedAt : undefined,
      xpReward: Math.max(0, Number(row.xpReward ?? 0)),
      decisionMinutesSaved: Math.max(0, Number(row.decisionMinutesSaved ?? 0)),
      why: String(row.why ?? ""),
      steps: parseFlowSteps(row.steps),
    };
  }

  if (typeof row.session_id === "string") {
    return serializeFlowSession(row as unknown as FlowSessionRow);
  }

  return null;
}

async function handleFlowDiagnostic(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const energyBaseline =
    typeof body.energyBaseline === "string"
      ? body.energyBaseline.toLowerCase().trim()
      : "";
  const focusPillar =
    typeof body.focusPillar === "string"
      ? body.focusPillar.toLowerCase().trim()
      : "";
  const frictionPoint =
    typeof body.frictionPoint === "string"
      ? body.frictionPoint.toLowerCase().trim()
      : "";

  if (!ALLOWED_FLOW_ENERGY_BASELINES.has(energyBaseline)) {
    return errorResponse(400, "energyBaseline must be one of: low, balanced, high");
  }
  if (!ALLOWED_FLOW_FOCUS_PILLARS.has(focusPillar)) {
    return errorResponse(
      400,
      "focusPillar must be one of: deep_work, vitality_health, local_discovery",
    );
  }
  if (!ALLOWED_FLOW_FRICTION_POINTS.has(frictionPoint)) {
    return errorResponse(
      400,
      "frictionPoint must be one of: decision_paralysis, procrastination",
    );
  }

  const { data, error } = await db.rpc("upsert_user_flow_diagnostic", {
    p_user_id: userId,
    p_energy_baseline: energyBaseline,
    p_focus_pillar: focusPillar,
    p_friction_point: frictionPoint,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleFlowHeroPlay(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const cityIdParam = url.searchParams.get("cityId");
  let cityId: "blr" | "nyc" | null = null;

  if (cityIdParam) {
    cityId = parseCityIdFromValue(cityIdParam);
    if (!cityId) {
      return errorResponse(400, "cityId must be one of: blr, nyc");
    }
  }

  const { data, error } = await db.rpc("get_hero_play", {
    p_user_id: userId,
    p_city_id: cityId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data || typeof data !== "object") {
    return errorResponse(500, "invalid_hero_response");
  }

  const payload = data as Record<string, unknown>;
  const status = String(payload.status ?? "diagnostic_required");
  if (status !== "ready") {
    return jsonResponse({
      status: "diagnostic_required",
      diagnosticCompletedAt:
        typeof payload.diagnosticCompletedAt === "string"
          ? payload.diagnosticCompletedAt
          : undefined,
    });
  }

  const heroPlay =
    payload.heroPlay && typeof payload.heroPlay === "object"
      ? payload.heroPlay
      : null;
  if (!heroPlay) {
    return errorResponse(500, "hero_play_missing");
  }

  return jsonResponse({
    status: "ready",
    diagnosticCompletedAt:
      typeof payload.diagnosticCompletedAt === "string"
        ? payload.diagnosticCompletedAt
        : undefined,
    heroPlay,
  });
}

async function handleFlowPlayStart(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const recommendationId =
    typeof body.recommendationId === "string"
      ? body.recommendationId.trim()
      : "";

  if (!recommendationId) {
    return errorResponse(400, "recommendationId is required");
  }

  const { data, error } = await db.rpc("start_play_session", {
    p_user_id: userId,
    p_recommendation_id: recommendationId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data || typeof data !== "object") {
    return errorResponse(500, "invalid_play_start_response");
  }

  const payload = data as Record<string, unknown>;
  const status = String(payload.status ?? "recommendation_not_found");
  if (status === "recommendation_not_found") {
    return errorResponse(404, "recommendation_not_found");
  }

  const session = normalizeFlowSessionPayload(payload.session);
  if (!session) {
    return errorResponse(500, "session_payload_missing");
  }

  return jsonResponse({
    status: "started",
    session,
  });
}

async function handleFlowPlaySession(
  db: DbClient,
  userId: string,
  sessionId: string,
): Promise<Response> {
  const normalizedSessionId = decodeURIComponent(sessionId).trim();
  if (!normalizedSessionId) {
    return errorResponse(400, "sessionId is required");
  }

  const { data, error } = await db.rpc("get_play_session_detail", {
    p_user_id: userId,
    p_play_session_id: normalizedSessionId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data || typeof data !== "object") {
    return errorResponse(500, "invalid_session_response");
  }

  const payload = data as Record<string, unknown>;
  if (payload.status === "not_found") {
    return errorResponse(404, "play_session_not_found");
  }

  const session = normalizeFlowSessionPayload(payload.session);
  if (!session) {
    return errorResponse(500, "session_payload_missing");
  }

  return jsonResponse({
    status: "ok",
    session,
  });
}

async function handleFlowStepDone(
  db: DbClient,
  userId: string,
  sessionId: string,
  stepOrderRaw: string,
): Promise<Response> {
  const normalizedSessionId = decodeURIComponent(sessionId).trim();
  const stepOrder = Number(stepOrderRaw);

  if (!normalizedSessionId) {
    return errorResponse(400, "sessionId is required");
  }
  if (!Number.isFinite(stepOrder) || stepOrder < 1) {
    return errorResponse(400, "stepOrder must be a positive integer");
  }

  const { data, error } = await db.rpc("mark_play_step_done", {
    p_user_id: userId,
    p_play_session_id: normalizedSessionId,
    p_step_order: Math.floor(stepOrder),
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data || typeof data !== "object") {
    return errorResponse(500, "invalid_step_result");
  }

  const payload = data as Record<string, unknown>;
  if (payload.status === "not_found") {
    return errorResponse(404, "play_session_not_found");
  }

  const session = normalizeFlowSessionPayload(payload.session);
  if (!session) {
    return errorResponse(500, "session_payload_missing");
  }

  const reward =
    payload.reward && typeof payload.reward === "object"
      ? payload.reward
      : undefined;

  return jsonResponse({
    status:
      payload.status === "already_completed"
        ? "already_completed"
        : payload.status === "completed"
          ? "completed"
          : "progressed",
    session,
    reward,
  });
}

async function handleFlowStateSummary(
  db: DbClient,
  userId: string,
): Promise<Response> {
  const { data, error } = await db.rpc("get_flowstate_summary", {
    p_user_id: userId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data || typeof data !== "object") {
    return errorResponse(500, "invalid_flowstate_summary");
  }

  const payload = data as Record<string, unknown>;
  const activeSession = normalizeFlowSessionPayload(payload.activeSession);

  return jsonResponse({
    stats:
      payload.stats && typeof payload.stats === "object"
        ? payload.stats
        : {
            xpTotal: 0,
            level: 1,
            playsCompleted: 0,
            decisionsSaved: 0,
            planningMinutesSaved: 0,
          },
    diagnosticCompletedAt:
      typeof payload.diagnosticCompletedAt === "string"
        ? payload.diagnosticCompletedAt
        : undefined,
    activeSession: activeSession ?? undefined,
  });
}

async function handlePatchMyProfile(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const updatePayload: {
    username?: string;
    avatar_url?: string | null;
    home_city_id?: "blr" | "nyc";
  } = {};

  if (body.username !== undefined) {
    const username = sanitizeUsername(body.username);
    if (!username) {
      return errorResponse(
        400,
        "username must be 3-32 chars (letters, numbers, underscore)",
      );
    }
    updatePayload.username = username;
  }

  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      updatePayload.avatar_url = null;
    } else if (typeof body.avatarUrl === "string") {
      updatePayload.avatar_url = body.avatarUrl;
    } else {
      return errorResponse(400, "avatarUrl must be string or null");
    }
  }

  if (body.homeCityId !== undefined) {
    if (
      typeof body.homeCityId !== "string" ||
      !ALLOWED_CITY_IDS.has(body.homeCityId)
    ) {
      return errorResponse(400, "homeCityId must be one of: blr, nyc");
    }
    updatePayload.home_city_id = body.homeCityId as "blr" | "nyc";
  }

  if (Object.keys(updatePayload).length === 0) {
    return errorResponse(400, "No profile fields to update");
  }

  const { error } = await db.from("profiles").update(updatePayload).eq("id", userId);
  if (error) {
    if (error.code === "23505") {
      return errorResponse(409, "username_already_taken");
    }
    return errorResponse(500, error.message);
  }

  return await handleUserSummary(db, userId);
}

async function handleRegisterPushToken(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const pushToken = typeof body.pushToken === "string" ? body.pushToken.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.toLowerCase() : "";
  const appVersion =
    typeof body.appVersion === "string" && body.appVersion.trim().length > 0
      ? body.appVersion.trim()
      : null;

  if (pushToken.length < 8) {
    return errorResponse(400, "pushToken is required");
  }

  if (platform !== "ios" && platform !== "android") {
    return errorResponse(400, "platform must be ios or android");
  }

  const { data, error } = await db.rpc("upsert_user_push_token", {
    p_user_id: userId,
    p_token: pushToken,
    p_platform: platform,
    p_app_version: appVersion,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function resolveExperimentAssignments(
  db: DbClient,
  userId: string,
): Promise<Record<string, "control" | "treatment">> {
  const experimentKey = "d2_nudge_holdout_v1";
  const fallback = computeDeterministicControlAssignment(`${userId}:${experimentKey}`, 10);
  const { data, error } = await db.rpc("assign_experiment_variant", {
    p_user_id: userId,
    p_experiment_key: experimentKey,
    p_default_variant: fallback,
  });

  if (error) {
    throw new Error(`Failed to assign experiment variant: ${error.message}`);
  }

  const variant = data === "control" || data === "treatment" ? data : fallback;
  return {
    [experimentKey]: variant,
  };
}

async function handleUserSummary(
  db: DbClient,
  userId: string,
): Promise<Response> {
  const [profileResult, statsResult, diagnosticResult] = await Promise.all([
      db
        .from("profiles")
        .select("id, username, avatar_url, home_city_id")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("user_stats")
        .select(
          "xp_total, level, streak_days, plays_completed, decisions_saved, planning_minutes_saved",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("user_flow_diagnostics")
        .select("completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    return errorResponse(500, profileResult.error.message);
  }

  if (statsResult.error) {
    return errorResponse(500, statsResult.error.message);
  }

  if (diagnosticResult.error) {
    return errorResponse(500, diagnosticResult.error.message);
  }

  const profile = profileResult.data;
  const stats = statsResult.data;
  const diagnostic = diagnosticResult.data;

  return jsonResponse({
    user: {
      id: profile?.id ?? userId,
      username: profile?.username ?? "Explorer",
      avatarUrl: profile?.avatar_url ?? undefined,
      homeCityId: profile?.home_city_id ?? undefined,
      flowDiagnosticCompletedAt: diagnostic?.completed_at ?? undefined,
    },
    stats: {
      xpTotal: stats?.xp_total ?? 0,
      level: stats?.level ?? 1,
      streakDays: stats?.streak_days ?? 0,
      playsCompleted: stats?.plays_completed ?? 0,
      decisionsSaved: stats?.decisions_saved ?? 0,
      planningMinutesSaved: stats?.planning_minutes_saved ?? 0,
    },
  });
}

async function handleBootstrap(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const cityId = parseCityId(url.searchParams);
  const { data, error } = await db.rpc("get_bootstrap_config", {
    p_city_id: cityId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(404, "city_not_found");
  }

  let experiments: Record<string, "control" | "treatment"> = {};
  try {
    experiments = await resolveExperimentAssignments(db, userId);
  } catch {
    experiments = {};
  }

  const quietHours =
    typeof data === "object" &&
    data &&
    typeof (data as Record<string, unknown>).quietHours === "object"
      ? (data as Record<string, unknown>).quietHours as {
          startLocal?: string;
          endLocal?: string;
        }
      : {};

  const normalizedQuietHours = {
    startLocal:
      typeof quietHours.startLocal === "string"
        ? quietHours.startLocal
        : "21:00",
    endLocal:
      typeof quietHours.endLocal === "string" ? quietHours.endLocal : "08:00",
  };

  const timeZone =
    typeof (data as Record<string, unknown>).timeZone === "string"
      ? String((data as Record<string, unknown>).timeZone)
      : "UTC";

  const suppressNow = isWithinQuietHours(
    new Date(),
    timeZone,
    normalizedQuietHours,
  );

  return jsonResponse({
    ...(data as Record<string, unknown>),
    experiments,
    notificationPolicy: {
      quietHours: normalizedQuietHours,
      timeZone,
      pushEnabled: true,
      suppressNow,
    },
  });
}

serve(async (req: Request) => {
  const startedAtMs = Date.now();
  const requestId =
    req.headers.get("x-request-id")?.trim() || crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "x-request-id": requestId,
        "x-release-sha": RELEASE_SHA,
      },
    });
  }

  const url = new URL(req.url);
  const route = normalizeRoute(url.pathname);
  let adminDb: DbClient | null = null;

  try {
    adminDb = makeAdminServiceClient();
  } catch {
    adminDb = null;
  }

  const finalize = async (
    response: Response,
    userId: string | null,
  ): Promise<Response> => {
    const responseWithHeaders = withMetaHeaders(response, requestId);

    if (adminDb) {
      await logApiRequestMetric(adminDb, {
        requestId,
        route,
        method: req.method,
        statusCode: responseWithHeaders.status,
        latencyMs: Date.now() - startedAtMs,
        userId,
      });
    }

    return responseWithHeaders;
  };

  let user: { id: string } | null = null;

  try {
    user = await requireAuthUser(req);
  } catch (error) {
    return finalize(
      errorResponse(500, `Auth client init failed: ${(error as Error).message}`),
      null,
    );
  }

  if (!user) {
    return finalize(errorResponse(401, "Unauthorized"), null);
  }

  let db: DbClient;

  try {
    db = makeServiceClient(req);
  } catch (error) {
    return finalize(errorResponse(500, (error as Error).message), user.id);
  }

  try {
    if (req.method === "POST" && route === "/flowstate/diagnostic") {
      return finalize(await handleFlowDiagnostic(req, db, user.id), user.id);
    }

    if (req.method === "GET" && route === "/flowstate/play/hero") {
      return finalize(await handleFlowHeroPlay(db, user.id, url), user.id);
    }

    if (req.method === "POST" && route === "/flowstate/play/start") {
      return finalize(await handleFlowPlayStart(req, db, user.id), user.id);
    }

    const flowSessionMatch = route.match(/^\/flowstate\/play\/sessions\/([^/]+)$/);
    if (req.method === "GET" && flowSessionMatch) {
      return finalize(
        await handleFlowPlaySession(db, user.id, flowSessionMatch[1]),
        user.id,
      );
    }

    const flowStepDoneMatch = route.match(
      /^\/flowstate\/play\/sessions\/([^/]+)\/steps\/([^/]+)\/done$/,
    );
    if (req.method === "POST" && flowStepDoneMatch) {
      return finalize(
        await handleFlowStepDone(
          db,
          user.id,
          flowStepDoneMatch[1],
          flowStepDoneMatch[2],
        ),
        user.id,
      );
    }

    if (req.method === "GET" && route === "/flowstate/summary") {
      return finalize(await handleFlowStateSummary(db, user.id), user.id);
    }

    if (req.method === "PATCH" && route === "/users/me/profile") {
      return finalize(await handlePatchMyProfile(req, db, user.id), user.id);
    }

    if (req.method === "POST" && route === "/notifications/register-token") {
      return finalize(await handleRegisterPushToken(req, db, user.id), user.id);
    }

    if (req.method === "GET" && route === "/users/me/summary") {
      return finalize(await handleUserSummary(db, user.id), user.id);
    }

    if (req.method === "GET" && route === "/config/bootstrap") {
      return finalize(await handleBootstrap(db, user.id, url), user.id);
    }

    if (req.method === "GET" && route === "/health") {
      return finalize(await handleHealth(), user.id);
    }

    return finalize(
      errorResponse(404, `Unknown route: ${req.method} ${route}`),
      user.id,
    );
  } catch (error) {
    return finalize(errorResponse(500, (error as Error).message), user.id);
  }
});
