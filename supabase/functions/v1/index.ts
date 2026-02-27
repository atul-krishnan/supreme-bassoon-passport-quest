import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireAuthUser } from "../_shared/auth.ts";

type DbClient = ReturnType<typeof createClient>;

const ALLOWED_CITY_IDS = new Set(["blr", "nyc"]);
const ALLOWED_FRIEND_REQUEST_STATUSES = new Set([
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);
const ALLOWED_TRIP_CONTEXT_TYPES = new Set([
  "solo",
  "couple",
  "family",
  "friends",
]);
const ALLOWED_PLAN_BUDGETS = new Set(["low", "medium", "high"]);
const ALLOWED_PLAN_PACES = new Set(["relaxed", "balanced", "active"]);
const ALLOWED_PLAN_FEEDBACK_TYPES = new Set([
  "shown",
  "opened",
  "started",
  "completed",
  "dismissed",
  "saved",
]);
const ALLOWED_TRIP_END_STATUSES = new Set(["completed", "cancelled"]);
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
const CITY_ANCHORS: Record<"blr" | "nyc", { lat: number; lng: number }> = {
  blr: { lat: 12.9763, lng: 77.5929 },
  nyc: { lat: 40.7536, lng: -73.9832 },
};

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

function parseFriendRequestStatus(searchParams: URLSearchParams) {
  const status = (searchParams.get("status") ?? "pending").toLowerCase();
  if (!ALLOWED_FRIEND_REQUEST_STATUSES.has(status)) {
    throw new Error("status must be one of: pending, accepted, rejected, cancelled");
  }
  return status;
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

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function takeFirstSentence(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const split = trimmed.split(/[.!?]/).map((part) => part.trim()).filter(Boolean);
  if (split.length === 0) {
    return trimmed.slice(0, 140);
  }
  return split[0].slice(0, 140);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(a));
}

function parseQuestGeo(
  geofenceJson: Record<string, unknown> | null | undefined,
): { lat: number; lng: number } | null {
  if (!geofenceJson || typeof geofenceJson !== "object") {
    return null;
  }
  const lat = Number(geofenceJson.lat);
  const lng = Number(geofenceJson.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function budgetRank(value: "low" | "medium" | "high") {
  if (value === "low") {
    return 1;
  }
  if (value === "medium") {
    return 2;
  }
  return 3;
}

function isBudgetCompatible(
  preferred: "low" | "medium" | "high",
  candidate: "low" | "medium" | "high",
) {
  if (preferred === "high") {
    return true;
  }
  if (preferred === "medium") {
    return candidate !== "high";
  }
  return candidate === "low";
}

function normalizeWhyRecommended(reasons: string[]) {
  const unique = Array.from(
    new Set(
      reasons
        .map((reason) => reason.trim())
        .filter((reason) => reason.length > 0),
    ),
  );
  if (unique.length === 0) {
    return [
      "Curated for your trip context",
      "Quick-to-start option with minimal planning effort",
    ];
  }
  if (unique.length === 1) {
    return [
      unique[0],
      "Quick-to-start option with minimal planning effort",
    ];
  }
  return unique.slice(0, 4);
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

async function handleNearby(
  req: Request,
  db: DbClient,
  url: URL,
): Promise<Response> {
  const cityId = parseCityId(url.searchParams);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusM = Number(url.searchParams.get("radiusM") ?? "1200");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse(400, "lat and lng must be finite numbers");
  }

  if (!Number.isFinite(radiusM) || radiusM <= 0) {
    return errorResponse(400, "radiusM must be a positive number");
  }

  const { data, error } = await db.rpc("get_nearby_quests", {
    p_city_id: cityId,
    p_lat: lat,
    p_lng: lng,
    p_radius_m: Math.min(5000, Math.floor(radiusM)),
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse({
    cityId,
    generatedAt: new Date().toISOString(),
    quests: (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      cityId: row.city_id,
      title: row.title,
      description: row.description,
      category: row.category,
      geofence: row.geofence,
      xpReward: row.xp_reward,
      badgeKey: row.badge_key ?? undefined,
      activeFrom: row.active_from,
      activeTo: row.active_to ?? undefined,
    })),
  });
}

async function handleComplete(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);

  const questId = body.questId;
  const occurredAt = body.occurredAt;
  const location = body.location;
  const deviceEventId = body.deviceEventId;

  if (
    typeof questId !== "string" ||
    typeof occurredAt !== "string" ||
    typeof deviceEventId !== "string"
  ) {
    return errorResponse(
      400,
      "questId, occurredAt and deviceEventId are required string fields",
    );
  }

  if (!location || typeof location !== "object") {
    return errorResponse(400, "location must be an object");
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

  const { data, error } = await db.rpc("complete_quest", {
    p_user_id: userId,
    p_quest_id: questId,
    p_occurred_at: occurredAt,
    p_location: location,
    p_device_event_id: deviceEventId,
    p_request_ip: ip,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

type TripContextRow = {
  id: string;
  user_id: string;
  city_id: "blr" | "nyc";
  context_type: "solo" | "couple" | "family" | "friends";
  time_budget_min: number;
  budget: "low" | "medium" | "high";
  pace: "relaxed" | "balanced" | "active";
  vibe_tags_json: unknown;
};

type QuestTagRow = {
  family_safe?: boolean;
  date_friendly?: boolean;
  kid_friendly?: boolean;
  wheelchair_accessible?: boolean;
  low_crowd?: boolean;
  indoor_option?: boolean;
  budget_band?: "low" | "medium" | "high";
  recommended_duration_min?: number;
  practical_details_json?: unknown;
  hero_image_url?: string | null;
};

type NormalizedQuestTags = {
  family_safe: boolean;
  date_friendly: boolean;
  kid_friendly: boolean;
  wheelchair_accessible: boolean;
  low_crowd: boolean;
  indoor_option: boolean;
  budget_band: "low" | "medium" | "high";
  recommended_duration_min: number;
  practical_details_json: string[];
  hero_image_url: string | null;
};

type QuestRowWithTags = {
  id: string;
  city_id: string;
  title: string;
  description: string;
  category: string;
  geofence_json: Record<string, unknown>;
  xp_reward: number;
  badge_key: string | null;
  active_from: string;
  active_to: string | null;
  quest_experience_tags?: QuestTagRow | QuestTagRow[] | null;
};

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

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  return [];
}

function normalizeQuestTags(value: unknown): NormalizedQuestTags {
  const source = Array.isArray(value)
    ? (value[0] as QuestTagRow | undefined)
    : (value as QuestTagRow | undefined);

  return {
    family_safe: Boolean(source?.family_safe),
    date_friendly: Boolean(source?.date_friendly),
    kid_friendly: Boolean(source?.kid_friendly),
    wheelchair_accessible: Boolean(source?.wheelchair_accessible),
    low_crowd: Boolean(source?.low_crowd),
    indoor_option: Boolean(source?.indoor_option),
    budget_band:
      source?.budget_band === "low" ||
      source?.budget_band === "medium" ||
      source?.budget_band === "high"
        ? source.budget_band
        : "medium",
    recommended_duration_min:
      typeof source?.recommended_duration_min === "number" &&
      Number.isFinite(source.recommended_duration_min)
        ? clampInt(source.recommended_duration_min, 30, 480)
        : 90,
    practical_details_json: normalizeStringArray(source?.practical_details_json),
    hero_image_url: typeof source?.hero_image_url === "string"
      ? source.hero_image_url
      : null,
  };
}

function countVibeMatches(quest: QuestRowWithTags, vibeTags: string[]) {
  const haystack = `${quest.title} ${quest.description}`.toLowerCase();
  let matches = 0;
  for (const vibe of vibeTags) {
    if (vibe.length > 0 && haystack.includes(vibe.toLowerCase())) {
      matches += 1;
    }
  }
  return matches;
}

function scoreRecommendationCandidate(
  quest: QuestRowWithTags,
  tags: NormalizedQuestTags,
  context: TripContextRow,
  vibeMatchCount: number,
  distanceFromCityAnchorM: number,
) {
  let score = Math.max(1, Math.floor(quest.xp_reward / 20));

  if (context.context_type === "couple" && tags.date_friendly) {
    score += 22;
  }
  if (context.context_type === "family" && tags.family_safe) {
    score += 20;
  }
  if (context.context_type === "solo" && tags.low_crowd) {
    score += 12;
  }
  if (context.context_type === "friends" && !tags.low_crowd) {
    score += 8;
  }

  if (context.budget === tags.budget_band) {
    score += 14;
  } else if (context.budget === "medium") {
    score += 6;
  }

  if (context.pace === "relaxed" && tags.low_crowd) {
    score += 8;
  }
  if (context.pace === "active" && (quest.category === "landmark" || quest.category === "culture")) {
    score += 7;
  }
  if (context.pace === "balanced") {
    score += 4;
  }

  score += vibeMatchCount * 4;
  score += Math.max(0, 14 - Math.floor(distanceFromCityAnchorM / 2000));
  return score;
}

function buildWhyRecommended(
  context: TripContextRow,
  quest: QuestRowWithTags,
  tags: NormalizedQuestTags,
  vibeMatchCount: number,
) {
  const reasons: string[] = [];

  if (context.context_type === "couple" && tags.date_friendly) {
    reasons.push("Matches couple-friendly vibe");
  } else if (context.context_type === "family" && tags.family_safe) {
    reasons.push("Family-safe and kid-friendly option");
  } else if (context.context_type === "solo" && tags.low_crowd) {
    reasons.push("Low-crowd option for solo time");
  } else if (context.context_type === "friends") {
    reasons.push("Good fit for a friends outing");
  }

  reasons.push(`Fits a ${context.budget} budget plan`);

  if (context.pace === "relaxed" && tags.low_crowd) {
    reasons.push("Relaxed pace with lower crowd intensity");
  } else if (context.pace === "active") {
    reasons.push("Active pace with engaging movement");
  } else {
    reasons.push("Balanced plan for a flexible outing");
  }

  if (vibeMatchCount > 0) {
    reasons.push("Matches your selected vibe tags");
  } else if (quest.category === "food") {
    reasons.push("Strong local food recommendation");
  } else if (quest.category === "culture") {
    reasons.push("High-quality local culture experience");
  } else {
    reasons.push("Popular Bangalore activity for this context");
  }

  return reasons.slice(0, 4);
}

function makePlanTitle(contextType: TripContextRow["context_type"], questTitle: string) {
  if (contextType === "couple") {
    return `Date Plan: ${questTitle}`;
  }
  if (contextType === "family") {
    return `Family Plan: ${questTitle}`;
  }
  if (contextType === "friends") {
    return `Group Plan: ${questTitle}`;
  }
  return `Solo Plan: ${questTitle}`;
}

async function handleTripContextStart(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const cityId = parseCityIdFromValue(body.cityId);
  const contextType =
    typeof body.contextType === "string" ? body.contextType.toLowerCase() : "";
  const timeBudgetMin = Number(body.timeBudgetMin);
  const budget =
    typeof body.budget === "string" ? body.budget.toLowerCase() : "medium";
  const pace = typeof body.pace === "string" ? body.pace.toLowerCase() : "balanced";
  const vibeTags = normalizeStringArray(body.vibeTags);
  const constraints =
    body.constraints && typeof body.constraints === "object"
      ? (body.constraints as Record<string, unknown>)
      : {};

  if (!cityId) {
    return errorResponse(400, "cityId must be one of: blr, nyc");
  }
  if (!ALLOWED_TRIP_CONTEXT_TYPES.has(contextType)) {
    return errorResponse(400, "contextType must be one of: solo, couple, family, friends");
  }
  if (!Number.isFinite(timeBudgetMin) || timeBudgetMin < 30 || timeBudgetMin > 720) {
    return errorResponse(400, "timeBudgetMin must be between 30 and 720");
  }
  if (!ALLOWED_PLAN_BUDGETS.has(budget)) {
    return errorResponse(400, "budget must be one of: low, medium, high");
  }
  if (!ALLOWED_PLAN_PACES.has(pace)) {
    return errorResponse(400, "pace must be one of: relaxed, balanced, active");
  }

  const { data, error } = await db.rpc("start_trip_context", {
    p_user_id: userId,
    p_city_id: cityId,
    p_context_type: contextType,
    p_time_budget_min: clampInt(timeBudgetMin, 30, 720),
    p_budget: budget,
    p_pace: pace,
    p_vibe_tags: vibeTags,
    p_constraints: constraints,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleTripContextUpdate(
  req: Request,
  db: DbClient,
  userId: string,
  tripContextId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const contextType =
    typeof body.contextType === "string" ? body.contextType.toLowerCase() : null;
  const budget = typeof body.budget === "string" ? body.budget.toLowerCase() : null;
  const pace = typeof body.pace === "string" ? body.pace.toLowerCase() : null;
  const timeBudgetMin =
    body.timeBudgetMin === undefined ? null : Number(body.timeBudgetMin);
  const vibeTags =
    body.vibeTags === undefined ? null : normalizeStringArray(body.vibeTags);
  const constraints =
    body.constraints === undefined
      ? null
      : body.constraints && typeof body.constraints === "object"
        ? (body.constraints as Record<string, unknown>)
        : null;

  if (contextType !== null && !ALLOWED_TRIP_CONTEXT_TYPES.has(contextType)) {
    return errorResponse(400, "contextType must be one of: solo, couple, family, friends");
  }
  if (budget !== null && !ALLOWED_PLAN_BUDGETS.has(budget)) {
    return errorResponse(400, "budget must be one of: low, medium, high");
  }
  if (pace !== null && !ALLOWED_PLAN_PACES.has(pace)) {
    return errorResponse(400, "pace must be one of: relaxed, balanced, active");
  }
  if (
    timeBudgetMin !== null &&
    (!Number.isFinite(timeBudgetMin) || timeBudgetMin < 30 || timeBudgetMin > 720)
  ) {
    return errorResponse(400, "timeBudgetMin must be between 30 and 720");
  }

  const { data, error } = await db.rpc("update_trip_context", {
    p_user_id: userId,
    p_trip_context_id: tripContextId,
    p_context_type: contextType,
    p_time_budget_min: timeBudgetMin !== null ? clampInt(timeBudgetMin, 30, 720) : null,
    p_budget: budget,
    p_pace: pace,
    p_vibe_tags: vibeTags,
    p_constraints: constraints,
  });

  if (error) {
    return errorResponse(500, error.message);
  }
  if (data && typeof data === "object" && (data as Record<string, unknown>).status === "not_found") {
    return errorResponse(404, "trip_context_not_found");
  }

  return jsonResponse(data);
}

async function handleTripContextEnd(
  req: Request,
  db: DbClient,
  userId: string,
  tripContextId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const status =
    typeof body.status === "string" ? body.status.toLowerCase() : "completed";

  if (!ALLOWED_TRIP_END_STATUSES.has(status)) {
    return errorResponse(400, "status must be one of: completed, cancelled");
  }

  const { data, error } = await db.rpc("end_trip_context", {
    p_user_id: userId,
    p_trip_context_id: tripContextId,
    p_status: status,
  });

  if (error) {
    return errorResponse(500, error.message);
  }
  if (data && typeof data === "object" && (data as Record<string, unknown>).status === "not_found") {
    return errorResponse(404, "trip_context_not_found");
  }

  return jsonResponse(data);
}

async function handleRecommendedPlans(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const cityId = parseCityId(url.searchParams);
  const tripContextId = url.searchParams.get("tripContextId");
  const limitRaw = Number(url.searchParams.get("limit") ?? "3");
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 3, 1, 3);

  if (!tripContextId || tripContextId.trim().length === 0) {
    return errorResponse(400, "tripContextId is required");
  }

  const contextResult = await db
    .from("trip_context_sessions")
    .select("id, user_id, city_id, context_type, time_budget_min, budget, pace, vibe_tags_json")
    .eq("id", tripContextId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contextResult.error) {
    return errorResponse(500, contextResult.error.message);
  }

  const context = (contextResult.data ?? null) as TripContextRow | null;
  if (!context) {
    return errorResponse(404, "trip_context_not_found");
  }
  if (context.city_id !== cityId) {
    return errorResponse(400, "tripContextId city does not match cityId");
  }

  const questResult = await db
    .from("quests")
    .select(`
      id,
      city_id,
      title,
      description,
      category,
      geofence_json,
      xp_reward,
      badge_key,
      active_from,
      active_to,
      quest_experience_tags (
        family_safe,
        date_friendly,
        kid_friendly,
        wheelchair_accessible,
        low_crowd,
        indoor_option,
        budget_band,
        recommended_duration_min,
        practical_details_json,
        hero_image_url
      )
    `)
    .eq("city_id", cityId)
    .eq("is_active", true)
    .order("active_from", { ascending: false })
    .limit(100);

  if (questResult.error) {
    return errorResponse(500, questResult.error.message);
  }

  const cityAnchor = CITY_ANCHORS[cityId];
  const now = Date.now();
  const vibeTags = normalizeStringArray(context.vibe_tags_json);
  const allActiveQuests = (questResult.data ?? [])
    .map((row) => row as unknown as QuestRowWithTags)
    .filter((quest) => {
      const startsAt = new Date(quest.active_from).getTime();
      const endsAt = quest.active_to ? new Date(quest.active_to).getTime() : null;
      if (Number.isFinite(startsAt) && startsAt > now) {
        return false;
      }
      if (endsAt !== null && Number.isFinite(endsAt) && endsAt < now) {
        return false;
      }
      return true;
    })
    .map((quest) => {
      const tags = normalizeQuestTags(quest.quest_experience_tags);
      const vibeMatchCount = countVibeMatches(quest, vibeTags);
      const geo = parseQuestGeo(quest.geofence_json);
      const distanceFromCityAnchorM = geo
        ? haversineMeters(cityAnchor.lat, cityAnchor.lng, geo.lat, geo.lng)
        : 6000;
      const score = scoreRecommendationCandidate(
        quest,
        tags,
        context,
        vibeMatchCount,
        distanceFromCityAnchorM,
      );
      return {
        quest,
        tags,
        vibeMatchCount,
        distanceFromCityAnchorM,
        recommendedDurationMin: clampInt(tags.recommended_duration_min, 30, 240),
        score,
      };
    });

  const candidates = (allActiveQuests.length > 0 ? allActiveQuests : [])
    .filter((candidate) => {
      const budgetOk = isBudgetCompatible(context.budget, candidate.tags.budget_band);
      const timeOk = candidate.recommendedDurationMin <= context.time_budget_min + 45;
      return budgetOk && timeOk;
    })
    .sort((a, b) => b.score - a.score);

  const rankedCandidates = (candidates.length > 0 ? candidates : allActiveQuests).sort(
    (a, b) => b.score - a.score,
  );

  const plans: Array<Record<string, unknown>> = [];
  const usedSeedQuestIds = new Set<string>();
  const usedSeedCategories = new Set<string>();

  const buildPlanFromSeed = (
    seed: (typeof rankedCandidates)[number],
    index: number,
  ) => {
    const selectedStops = [seed];
    let totalDuration = seed.recommendedDurationMin;
    const usedCategories = new Set<string>([seed.quest.category]);

    for (const candidate of rankedCandidates) {
      if (selectedStops.length >= 3) {
        break;
      }
      if (candidate.quest.id === seed.quest.id) {
        continue;
      }

      const isDuplicateCategory = usedCategories.has(candidate.quest.category);
      if (isDuplicateCategory && selectedStops.length >= 2) {
        continue;
      }

      const proposedDuration = totalDuration + candidate.recommendedDurationMin;
      if (proposedDuration > context.time_budget_min + 45) {
        continue;
      }

      selectedStops.push(candidate);
      totalDuration = proposedDuration;
      usedCategories.add(candidate.quest.category);
    }

    const spendBandRank = selectedStops.reduce(
      (maxRank, stop) => Math.max(maxRank, budgetRank(stop.tags.budget_band)),
      1,
    );
    const estimatedSpendBand = spendBandRank <= 1
      ? "low"
      : spendBandRank === 2
        ? "medium"
        : "high";

    const whyRecommended = normalizeWhyRecommended([
      ...buildWhyRecommended(
        context,
        seed.quest,
        seed.tags,
        seed.vibeMatchCount,
      ),
      ...(selectedStops.length > 1
        ? ["Includes varied stops in one ready-made route"]
        : []),
      ...(seed.distanceFromCityAnchorM <= 6000
        ? ["Stops are relatively close for easier travel"]
        : []),
    ]);

    return {
      planId: `${context.id}:${seed.quest.id}:${index + 1}`,
      title: makePlanTitle(context.context_type, seed.quest.title),
      summary:
        selectedStops.length > 1
          ? `${takeFirstSentence(seed.quest.description)} + ${selectedStops.length - 1} more stop(s).`
          : takeFirstSentence(seed.quest.description) || seed.quest.description,
      estimatedDurationMin: clampInt(totalDuration, 30, 360),
      estimatedSpendBand,
      whyRecommended,
      stops: selectedStops.map((candidate, stopIndex) => {
        const practicalDetails =
          candidate.tags.practical_details_json.length > 0
            ? candidate.tags.practical_details_json.slice(0, 3)
            : [
                `Target duration ~${candidate.recommendedDurationMin} minutes`,
                `Budget fit: ${candidate.tags.budget_band}`,
              ];

        return {
          questId: candidate.quest.id,
          title: candidate.quest.title,
          order: stopIndex + 1,
          visitDurationMin: candidate.recommendedDurationMin,
          storySnippet:
            takeFirstSentence(candidate.quest.description) ||
            candidate.quest.description,
          practicalDetails,
          heroImageUrl: candidate.tags.hero_image_url ?? undefined,
        };
      }),
    };
  };

  for (const candidate of rankedCandidates) {
    if (plans.length >= limit) {
      break;
    }
    if (usedSeedQuestIds.has(candidate.quest.id)) {
      continue;
    }
    if (
      usedSeedCategories.has(candidate.quest.category) &&
      rankedCandidates.length > limit
    ) {
      continue;
    }
    plans.push(buildPlanFromSeed(candidate, plans.length));
    usedSeedQuestIds.add(candidate.quest.id);
    usedSeedCategories.add(candidate.quest.category);
  }

  if (plans.length < limit) {
    for (const candidate of rankedCandidates) {
      if (plans.length >= limit) {
        break;
      }
      if (usedSeedQuestIds.has(candidate.quest.id)) {
        continue;
      }
      plans.push(buildPlanFromSeed(candidate, plans.length));
      usedSeedQuestIds.add(candidate.quest.id);
    }
  }

  if (plans.length === 0 && rankedCandidates.length > 0) {
    const fallback = rankedCandidates[0];
    plans.push({
      planId: `${context.id}:${fallback.quest.id}:fallback`,
      title: makePlanTitle(context.context_type, fallback.quest.title),
      summary: takeFirstSentence(fallback.quest.description) || fallback.quest.description,
      estimatedDurationMin: fallback.recommendedDurationMin,
      estimatedSpendBand: fallback.tags.budget_band,
      whyRecommended: normalizeWhyRecommended([
        "Limited matching options right now",
        "Showing the best available single-stop plan",
      ]),
      stops: [
        {
          questId: fallback.quest.id,
          title: fallback.quest.title,
          order: 1,
          visitDurationMin: fallback.recommendedDurationMin,
          storySnippet:
            takeFirstSentence(fallback.quest.description) || fallback.quest.description,
          practicalDetails:
            fallback.tags.practical_details_json.length > 0
              ? fallback.tags.practical_details_json.slice(0, 3)
              : ["Best available option for the selected context"],
          heroImageUrl: fallback.tags.hero_image_url ?? undefined,
        },
      ],
    });
  }

  return jsonResponse({
    tripContextId: context.id,
    cityId,
    plans,
  });
}

async function handleRecommendationFeedback(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const tripContextId =
    typeof body.tripContextId === "string" ? body.tripContextId : "";
  const planId = typeof body.planId === "string" ? body.planId : "";
  const questId = typeof body.questId === "string" ? body.questId : null;
  const feedbackType =
    typeof body.feedbackType === "string" ? body.feedbackType.toLowerCase() : "";
  const metadata =
    body.metadata && typeof body.metadata === "object"
      ? (body.metadata as Record<string, unknown>)
      : {};

  if (tripContextId.length === 0 || planId.length === 0) {
    return errorResponse(400, "tripContextId and planId are required");
  }
  if (!ALLOWED_PLAN_FEEDBACK_TYPES.has(feedbackType)) {
    return errorResponse(400, "feedbackType is invalid");
  }

  const { data, error } = await db.rpc("record_recommendation_feedback", {
    p_user_id: userId,
    p_trip_context_id: tripContextId,
    p_plan_id: planId,
    p_quest_id: questId,
    p_feedback_type: feedbackType,
    p_metadata: metadata,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleSavePlan(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const tripContextId =
    typeof body.tripContextId === "string" ? body.tripContextId.trim() : "";
  const cityId = parseCityIdFromValue(body.cityId);
  const planPayload =
    body.planPayload && typeof body.planPayload === "object"
      ? (body.planPayload as Record<string, unknown>)
      : null;

  if (!planId || !tripContextId || !cityId || !planPayload) {
    return errorResponse(400, "planId, tripContextId, cityId and planPayload are required");
  }

  const { data, error } = await db.rpc("save_plan", {
    p_user_id: userId,
    p_plan_id: planId,
    p_trip_context_id: tripContextId,
    p_city_id: cityId,
    p_plan_payload: planPayload,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleGetSavedPlans(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 20, 1, 100);
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam && cursorParam.length > 0 ? cursorParam : null;

  const { data, error } = await db.rpc("get_saved_plans", {
    p_user_id: userId,
    p_limit: limit,
    p_cursor: cursor,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  const items = (data ?? []).map((row: Record<string, unknown>) => ({
    planId: String(row.plan_id),
    tripContextId:
      typeof row.trip_context_id === "string" ? String(row.trip_context_id) : undefined,
    cityId: String(row.city_id),
    planPayload: (row.plan_payload ?? {}) as Record<string, unknown>,
    savedAt: String(row.saved_at),
    updatedAt: String(row.updated_at),
  }));

  const nextCursor = items.length === limit ? items.at(-1)?.updatedAt : undefined;

  return jsonResponse({
    items,
    nextCursor,
  });
}

async function handleDeleteSavedPlan(
  db: DbClient,
  userId: string,
  planId: string,
): Promise<Response> {
  const normalizedPlanId = decodeURIComponent(planId).trim();
  if (!normalizedPlanId) {
    return errorResponse(400, "planId is required");
  }

  const { data, error } = await db.rpc("delete_saved_plan", {
    p_user_id: userId,
    p_plan_id: normalizedPlanId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (data && typeof data === "object" && (data as Record<string, unknown>).status === "not_found") {
    return errorResponse(404, "saved_plan_not_found");
  }

  return jsonResponse(data);
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

async function handleSocialFeed(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam && cursorParam.length > 0 ? cursorParam : null;

  if (!Number.isFinite(limit) || limit <= 0) {
    return errorResponse(400, "limit must be a positive number");
  }

  const { data, error } = await db.rpc("get_social_feed", {
    p_user_id: userId,
    p_limit: Math.min(100, Math.floor(limit)),
    p_cursor: cursor,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  const events = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    payload: row.payload_json,
    createdAt: row.created_at,
  }));

  const nextCursor =
    events.length === Math.min(100, Math.floor(limit))
      ? events.at(-1)?.createdAt
      : undefined;

  return jsonResponse({ events, nextCursor });
}

async function handleFriendRequest(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const receiverUserId = body.receiverUserId;

  if (typeof receiverUserId !== "string") {
    return errorResponse(400, "receiverUserId is required");
  }

  const { data, error } = await db.rpc("request_friend", {
    p_sender_user_id: userId,
    p_receiver_user_id: receiverUserId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleFriendRequestByUsername(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const username = sanitizeUsername(body.username);
  if (!username) {
    return errorResponse(
      400,
      "username must be 3-32 chars (letters, numbers, underscore)",
    );
  }

  const { data, error } = await db.rpc("request_friend_by_username", {
    p_sender_user_id: userId,
    p_receiver_username: username,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleFriendAccept(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  const body = await readJsonBody(req);
  const requestId = body.requestId;

  if (typeof requestId !== "string") {
    return errorResponse(400, "requestId is required");
  }

  const { data, error } = await db.rpc("accept_friend_request", {
    p_request_id: requestId,
    p_receiver_user_id: userId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleIncomingFriendRequests(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  let status: string;
  try {
    status = parseFriendRequestStatus(url.searchParams);
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  const limit = Number(url.searchParams.get("limit") ?? "30");
  if (!Number.isFinite(limit) || limit <= 0) {
    return errorResponse(400, "limit must be a positive number");
  }

  const { data, error } = await db.rpc("get_incoming_friend_requests", {
    p_user_id: userId,
    p_status: status,
    p_limit: Math.min(100, Math.floor(limit)),
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse({
    requests: (data ?? []).map((row: Record<string, unknown>) => ({
      requestId: row.request_id,
      senderUserId: row.sender_user_id,
      senderUsername: row.sender_username,
      senderAvatarUrl: row.sender_avatar_url ?? undefined,
      createdAt: row.created_at,
      status: row.status,
    })),
  });
}

async function handleProfileCompare(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const friendUserId = url.searchParams.get("friendUserId");
  if (!friendUserId) {
    return errorResponse(400, "friendUserId is required");
  }

  const { data, error } = await db.rpc("profile_compare", {
    p_user_id: userId,
    p_friend_user_id: friendUserId,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(403, "friendship_required");
  }

  return jsonResponse(data);
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
  const [
    profileResult,
    statsResult,
    completionCountResult,
    badgeCountResult,
    diagnosticResult,
  ] = await Promise.all([
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
        .from("quest_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "accepted"),
      db
        .from("user_badges")
        .select("badge_key", { count: "exact", head: true })
        .eq("user_id", userId),
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

  if (completionCountResult.error) {
    return errorResponse(500, completionCountResult.error.message);
  }

  if (badgeCountResult.error) {
    return errorResponse(500, badgeCountResult.error.message);
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
      questsCompleted: completionCountResult.count ?? 0,
      badgeCount: badgeCountResult.count ?? 0,
      playsCompleted: stats?.plays_completed ?? 0,
      decisionsSaved: stats?.decisions_saved ?? 0,
      planningMinutesSaved: stats?.planning_minutes_saved ?? 0,
    },
  });
}

async function handleUserBadges(
  db: DbClient,
  userId: string,
): Promise<Response> {
  const [catalogResult, unlockedResult] = await Promise.all([
    db
      .from("badges")
      .select("key, name, description, icon_url, created_at")
      .order("created_at", { ascending: true }),
    db
      .from("user_badges")
      .select("badge_key, unlocked_at")
      .eq("user_id", userId),
  ]);

  if (catalogResult.error) {
    return errorResponse(500, catalogResult.error.message);
  }

  if (unlockedResult.error) {
    return errorResponse(500, unlockedResult.error.message);
  }

  const unlockedByKey = new Map<string, string>();
  for (const row of unlockedResult.data ?? []) {
    unlockedByKey.set(String(row.badge_key), String(row.unlocked_at));
  }

  return jsonResponse({
    badges: (catalogResult.data ?? []).map((badge) => {
      const unlockedAt = unlockedByKey.get(String(badge.key));
      return {
        key: String(badge.key),
        name: String(badge.name),
        description: String(badge.description),
        iconUrl: badge.icon_url ? String(badge.icon_url) : undefined,
        unlocked: Boolean(unlockedAt),
        unlockedAt,
      };
    }),
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
    if (req.method === "GET" && route === "/quests/nearby") {
      return finalize(await handleNearby(req, db, url), user.id);
    }

    if (req.method === "POST" && route === "/quests/complete") {
      return finalize(await handleComplete(req, db, user.id), user.id);
    }

    if (req.method === "POST" && route === "/trips/context/start") {
      return finalize(await handleTripContextStart(req, db, user.id), user.id);
    }

    const tripContextPatchMatch = route.match(/^\/trips\/context\/([^/]+)$/);
    if (req.method === "PATCH" && tripContextPatchMatch) {
      return finalize(
        await handleTripContextUpdate(req, db, user.id, tripContextPatchMatch[1]),
        user.id,
      );
    }

    const tripContextEndMatch = route.match(/^\/trips\/context\/([^/]+)\/end$/);
    if (req.method === "POST" && tripContextEndMatch) {
      return finalize(
        await handleTripContextEnd(req, db, user.id, tripContextEndMatch[1]),
        user.id,
      );
    }

    if (req.method === "GET" && route === "/plans/recommended") {
      return finalize(await handleRecommendedPlans(db, user.id, url), user.id);
    }

    if (req.method === "GET" && route === "/quests/recommended") {
      return finalize(await handleRecommendedPlans(db, user.id, url), user.id);
    }

    if (req.method === "POST" && route === "/recommendations/feedback") {
      return finalize(
        await handleRecommendationFeedback(req, db, user.id),
        user.id,
      );
    }

    if (req.method === "POST" && route === "/plans/save") {
      return finalize(await handleSavePlan(req, db, user.id), user.id);
    }

    if (req.method === "GET" && route === "/plans/saved") {
      return finalize(await handleGetSavedPlans(db, user.id, url), user.id);
    }

    const planDeleteMatch = route.match(/^\/plans\/saved\/([^/]+)$/);
    if (req.method === "DELETE" && planDeleteMatch) {
      return finalize(
        await handleDeleteSavedPlan(db, user.id, planDeleteMatch[1]),
        user.id,
      );
    }

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

    if (req.method === "GET" && route === "/social/feed") {
      return finalize(await handleSocialFeed(db, user.id, url), user.id);
    }

    if (req.method === "POST" && route === "/social/friends/request") {
      return finalize(await handleFriendRequest(req, db, user.id), user.id);
    }

    if (
      req.method === "POST" &&
      route === "/social/friends/request-by-username"
    ) {
      return finalize(
        await handleFriendRequestByUsername(req, db, user.id),
        user.id,
      );
    }

    if (req.method === "POST" && route === "/social/friends/accept") {
      return finalize(await handleFriendAccept(req, db, user.id), user.id);
    }

    if (req.method === "GET" && route === "/social/friend-requests/incoming") {
      return finalize(
        await handleIncomingFriendRequests(db, user.id, url),
        user.id,
      );
    }

    if (req.method === "GET" && route === "/users/me/profile-compare") {
      return finalize(await handleProfileCompare(db, user.id, url), user.id);
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

    if (req.method === "GET" && route === "/users/me/badges") {
      return finalize(await handleUserBadges(db, user.id), user.id);
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
