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
const ALLOWED_TRIP_PACE_VALUES = new Set([
  "relaxed",
  "balanced",
  "active",
]);
const ALLOWED_TRIP_BUDGET_VALUES = new Set(["low", "medium", "high"]);
const ALLOWED_TRIP_TRANSPORT_VALUES = new Set([
  "walk",
  "public_transit",
  "bike",
  "car",
  "mixed",
]);
const ALLOWED_TRIP_END_STATUS_VALUES = new Set(["completed", "cancelled"]);
const ALLOWED_RECOMMENDATION_FEEDBACK_TYPES = new Set([
  "shown",
  "opened",
  "started",
  "completed",
  "dismissed",
  "saved",
]);
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseRouteUuidParam(route: string, pattern: RegExp): string | null {
  const match = route.match(pattern);
  if (!match || !match[1]) {
    return null;
  }
  return UUID_PATTERN.test(match[1]) ? match[1] : null;
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

function parseEnumValue(
  value: unknown,
  allowed: Set<string>,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw new Error(`${fieldName} has an invalid value`);
  }
  return normalized;
}

function parseOptionalTimestamp(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be an ISO timestamp`);
  }
  return value;
}

function parseOptionalStringArray(value: unknown, fieldName: string): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
  return value;
}

function parseOptionalObject(value: unknown, fieldName: string): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
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

async function handleStartTripContext(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  const cityId =
    typeof body.cityId === "string" ? body.cityId.trim().toLowerCase() : null;
  if (!cityId || !ALLOWED_CITY_IDS.has(cityId)) {
    return errorResponse(400, "cityId must be one of: blr, nyc");
  }

  let contextType: string | null = null;
  let pace: string | null = null;
  let budget: string | null = null;
  let transportMode: string | null = null;
  let startLocal: string | null = null;
  let vibeTags: string[] | null = null;
  let constraints: Record<string, unknown> | null = null;

  try {
    contextType = parseEnumValue(
      body.contextType,
      ALLOWED_TRIP_CONTEXT_TYPES,
      "contextType",
    );
    pace = parseEnumValue(body.pace, ALLOWED_TRIP_PACE_VALUES, "pace");
    budget = parseEnumValue(body.budget, ALLOWED_TRIP_BUDGET_VALUES, "budget");
    transportMode = parseEnumValue(
      body.transportMode,
      ALLOWED_TRIP_TRANSPORT_VALUES,
      "transportMode",
    );
    startLocal = parseOptionalTimestamp(body.startLocal, "startLocal");
    vibeTags = parseOptionalStringArray(body.vibeTags, "vibeTags");
    constraints = parseOptionalObject(body.constraints, "constraints");
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  if (!contextType) {
    return errorResponse(400, "contextType is required");
  }

  let groupSize = 1;
  if (body.groupSize !== undefined) {
    if (
      typeof body.groupSize !== "number" ||
      !Number.isInteger(body.groupSize) ||
      body.groupSize < 1 ||
      body.groupSize > 20
    ) {
      return errorResponse(400, "groupSize must be an integer between 1 and 20");
    }
    groupSize = body.groupSize;
  }

  let withKids = false;
  if (body.withKids !== undefined) {
    if (typeof body.withKids !== "boolean") {
      return errorResponse(400, "withKids must be a boolean");
    }
    withKids = body.withKids;
  }

  let timeBudgetMin = 180;
  if (body.timeBudgetMin !== undefined) {
    if (
      typeof body.timeBudgetMin !== "number" ||
      !Number.isInteger(body.timeBudgetMin) ||
      body.timeBudgetMin < 30 ||
      body.timeBudgetMin > 720
    ) {
      return errorResponse(400, "timeBudgetMin must be an integer between 30 and 720");
    }
    timeBudgetMin = body.timeBudgetMin;
  }

  const { data, error } = await db.rpc("start_trip_context", {
    p_user_id: userId,
    p_city_id: cityId,
    p_context_type: contextType,
    p_group_size: groupSize,
    p_with_kids: withKids,
    p_pace: pace ?? "balanced",
    p_budget: budget ?? "medium",
    p_transport_mode: transportMode ?? "mixed",
    p_time_budget_min: timeBudgetMin,
    p_start_local: startLocal,
    p_vibe_tags: vibeTags ?? [],
    p_constraints: constraints ?? {},
  });

  if (error) {
    if (/invalid_city/i.test(error.message)) {
      return errorResponse(400, "cityId is invalid or inactive");
    }
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleUpdateTripContext(
  req: Request,
  db: DbClient,
  userId: string,
  tripContextId: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  const allowedFields = [
    "contextType",
    "groupSize",
    "withKids",
    "pace",
    "budget",
    "transportMode",
    "timeBudgetMin",
    "startLocal",
    "vibeTags",
    "constraints",
  ];
  const hasPatch = allowedFields.some((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  if (!hasPatch) {
    return errorResponse(400, "No trip context fields to update");
  }

  let contextType: string | null = null;
  let pace: string | null = null;
  let budget: string | null = null;
  let transportMode: string | null = null;
  let startLocal: string | null = null;
  let vibeTags: string[] | null = null;
  let constraints: Record<string, unknown> | null = null;

  try {
    contextType = parseEnumValue(
      body.contextType,
      ALLOWED_TRIP_CONTEXT_TYPES,
      "contextType",
    );
    pace = parseEnumValue(body.pace, ALLOWED_TRIP_PACE_VALUES, "pace");
    budget = parseEnumValue(body.budget, ALLOWED_TRIP_BUDGET_VALUES, "budget");
    transportMode = parseEnumValue(
      body.transportMode,
      ALLOWED_TRIP_TRANSPORT_VALUES,
      "transportMode",
    );
    startLocal = parseOptionalTimestamp(body.startLocal, "startLocal");
    vibeTags = parseOptionalStringArray(body.vibeTags, "vibeTags");
    constraints = parseOptionalObject(body.constraints, "constraints");
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  let groupSize: number | null = null;
  if (body.groupSize !== undefined) {
    if (
      typeof body.groupSize !== "number" ||
      !Number.isInteger(body.groupSize) ||
      body.groupSize < 1 ||
      body.groupSize > 20
    ) {
      return errorResponse(400, "groupSize must be an integer between 1 and 20");
    }
    groupSize = body.groupSize;
  }

  let withKids: boolean | null = null;
  if (body.withKids !== undefined) {
    if (typeof body.withKids !== "boolean") {
      return errorResponse(400, "withKids must be a boolean");
    }
    withKids = body.withKids;
  }

  let timeBudgetMin: number | null = null;
  if (body.timeBudgetMin !== undefined) {
    if (
      typeof body.timeBudgetMin !== "number" ||
      !Number.isInteger(body.timeBudgetMin) ||
      body.timeBudgetMin < 30 ||
      body.timeBudgetMin > 720
    ) {
      return errorResponse(400, "timeBudgetMin must be an integer between 30 and 720");
    }
    timeBudgetMin = body.timeBudgetMin;
  }

  const { data, error } = await db.rpc("update_trip_context", {
    p_user_id: userId,
    p_trip_context_id: tripContextId,
    p_context_type: contextType,
    p_group_size: groupSize,
    p_with_kids: withKids,
    p_pace: pace,
    p_budget: budget,
    p_transport_mode: transportMode,
    p_time_budget_min: timeBudgetMin,
    p_start_local: startLocal,
    p_vibe_tags: vibeTags,
    p_constraints: constraints,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(404, "trip_context_not_found_or_inactive");
  }

  return jsonResponse(data);
}

async function handleEndTripContext(
  req: Request,
  db: DbClient,
  userId: string,
  tripContextId: string,
): Promise<Response> {
  let status = "completed";
  try {
    const body = await readJsonBody(req);
    const parsed = parseEnumValue(
      body.status,
      ALLOWED_TRIP_END_STATUS_VALUES,
      "status",
    );
    if (parsed) {
      status = parsed;
    }
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  const { data, error } = await db.rpc("end_trip_context", {
    p_user_id: userId,
    p_trip_context_id: tripContextId,
    p_status: status,
  });

  if (error) {
    if (/invalid_status/i.test(error.message)) {
      return errorResponse(400, "status must be completed or cancelled");
    }
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(404, "trip_context_not_found_or_inactive");
  }

  return jsonResponse(data);
}

async function handleRecommendedQuests(
  db: DbClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const cityId = parseCityId(url.searchParams);
  const tripContextId = url.searchParams.get("tripContextId");
  if (!tripContextId || !UUID_PATTERN.test(tripContextId)) {
    return errorResponse(400, "tripContextId must be a valid UUID");
  }

  const limit = Number(url.searchParams.get("limit") ?? "20");
  if (!Number.isFinite(limit) || limit <= 0) {
    return errorResponse(400, "limit must be a positive number");
  }

  const normalizedLimit = Math.min(50, Math.floor(limit));

  const { data, error } = await db.rpc("get_recommended_quests", {
    p_user_id: userId,
    p_city_id: cityId,
    p_trip_context_id: tripContextId,
    p_limit: normalizedLimit,
  });

  if (error) {
    if (/trip_context_not_found/i.test(error.message)) {
      return errorResponse(404, "trip_context_not_found");
    }
    if (/trip_context_city_mismatch/i.test(error.message)) {
      return errorResponse(400, "trip_context_city_mismatch");
    }
    return errorResponse(500, error.message);
  }

  return jsonResponse({
    tripContextId,
    cityId,
    quests: (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.quest_id,
      cityId: row.city_id,
      title: row.title,
      description: row.description,
      category: row.category,
      geofence: row.geofence,
      xpReward: row.xp_reward,
      badgeKey: row.badge_key ?? undefined,
      activeFrom: row.active_from,
      activeTo: row.active_to ?? undefined,
      tags: row.tags_json ?? {},
      whyRecommended: Array.isArray(row.why_recommended)
        ? row.why_recommended
        : [],
      score: typeof row.score === "number" ? row.score : Number(row.score ?? 0),
    })),
  });
}

async function handleRecommendationFeedback(
  req: Request,
  db: DbClient,
  userId: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  const questId = body.questId;
  const tripContextId = body.tripContextId;
  let feedbackType: string | null = null;
  let metadata: Record<string, unknown> | null = null;

  if (typeof questId !== "string" || !UUID_PATTERN.test(questId)) {
    return errorResponse(400, "questId must be a valid UUID");
  }

  if (
    tripContextId !== undefined &&
    tripContextId !== null &&
    (typeof tripContextId !== "string" || !UUID_PATTERN.test(tripContextId))
  ) {
    return errorResponse(400, "tripContextId must be a valid UUID");
  }

  try {
    feedbackType = parseEnumValue(
      body.feedbackType,
      ALLOWED_RECOMMENDATION_FEEDBACK_TYPES,
      "feedbackType",
    );
    metadata = parseOptionalObject(body.metadata, "metadata");
  } catch (error) {
    return errorResponse(400, (error as Error).message);
  }

  if (!feedbackType) {
    return errorResponse(400, "feedbackType is required");
  }

  const { data, error } = await db.rpc("record_recommendation_feedback", {
    p_user_id: userId,
    p_trip_context_id: tripContextId ?? null,
    p_quest_id: questId,
    p_feedback_type: feedbackType,
    p_metadata: metadata ?? {},
  });

  if (error) {
    if (/trip_context_not_found/i.test(error.message)) {
      return errorResponse(404, "trip_context_not_found");
    }
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
  const [profileResult, statsResult, completionCountResult, badgeCountResult] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, username, avatar_url, home_city_id")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("user_stats")
        .select("xp_total, level, streak_days")
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

  const profile = profileResult.data;
  const stats = statsResult.data;

  return jsonResponse({
    user: {
      id: profile?.id ?? userId,
      username: profile?.username ?? "Explorer",
      avatarUrl: profile?.avatar_url ?? undefined,
      homeCityId: profile?.home_city_id ?? undefined,
    },
    stats: {
      xpTotal: stats?.xp_total ?? 0,
      level: stats?.level ?? 1,
      streakDays: stats?.streak_days ?? 0,
      questsCompleted: completionCountResult.count ?? 0,
      badgeCount: badgeCountResult.count ?? 0,
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let user: { id: string } | null = null;

  try {
    user = await requireAuthUser(req);
  } catch (error) {
    return errorResponse(
      500,
      `Auth client init failed: ${(error as Error).message}`,
    );
  }

  if (!user) {
    return errorResponse(401, "Unauthorized");
  }

  const url = new URL(req.url);
  const route = normalizeRoute(url.pathname);

  let db: DbClient;

  try {
    db = makeServiceClient(req);
  } catch (error) {
    return errorResponse(500, (error as Error).message);
  }

  try {
    const tripContextUpdateId = parseRouteUuidParam(
      route,
      /^\/trips\/context\/([^/]+)$/,
    );
    const tripContextEndId = parseRouteUuidParam(
      route,
      /^\/trips\/context\/([^/]+)\/end$/,
    );

    if (req.method === "GET" && route === "/quests/nearby") {
      return await handleNearby(req, db, url);
    }

    if (req.method === "POST" && route === "/quests/complete") {
      return await handleComplete(req, db, user.id);
    }

    if (req.method === "GET" && route === "/quests/recommended") {
      return await handleRecommendedQuests(db, user.id, url);
    }

    if (req.method === "GET" && route === "/social/feed") {
      return await handleSocialFeed(db, user.id, url);
    }

    if (req.method === "POST" && route === "/social/friends/request") {
      return await handleFriendRequest(req, db, user.id);
    }

    if (
      req.method === "POST" &&
      route === "/social/friends/request-by-username"
    ) {
      return await handleFriendRequestByUsername(req, db, user.id);
    }

    if (req.method === "POST" && route === "/social/friends/accept") {
      return await handleFriendAccept(req, db, user.id);
    }

    if (req.method === "GET" && route === "/social/friend-requests/incoming") {
      return await handleIncomingFriendRequests(db, user.id, url);
    }

    if (req.method === "GET" && route === "/users/me/profile-compare") {
      return await handleProfileCompare(db, user.id, url);
    }

    if (req.method === "PATCH" && route === "/users/me/profile") {
      return await handlePatchMyProfile(req, db, user.id);
    }

    if (req.method === "POST" && route === "/notifications/register-token") {
      return await handleRegisterPushToken(req, db, user.id);
    }

    if (req.method === "GET" && route === "/users/me/summary") {
      return await handleUserSummary(db, user.id);
    }

    if (req.method === "GET" && route === "/users/me/badges") {
      return await handleUserBadges(db, user.id);
    }

    if (req.method === "GET" && route === "/config/bootstrap") {
      return await handleBootstrap(db, user.id, url);
    }

    if (req.method === "POST" && route === "/trips/context/start") {
      return await handleStartTripContext(req, db, user.id);
    }

    if (req.method === "PATCH" && tripContextUpdateId) {
      return await handleUpdateTripContext(req, db, user.id, tripContextUpdateId);
    }

    if (req.method === "POST" && tripContextEndId) {
      return await handleEndTripContext(req, db, user.id, tripContextEndId);
    }

    if (req.method === "POST" && route === "/recommendations/feedback") {
      return await handleRecommendationFeedback(req, db, user.id);
    }

    return errorResponse(404, `Unknown route: ${req.method} ${route}`);
  } catch (error) {
    return errorResponse(500, (error as Error).message);
  }
});
