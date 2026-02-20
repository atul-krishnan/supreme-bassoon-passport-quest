import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireAuthUser } from "../_shared/auth.ts";

type DbClient = ReturnType<typeof createClient>;

const ALLOWED_CITY_IDS = new Set(["blr", "nyc"]);

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
        Authorization: authHeader
      }
    }
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

async function handleNearby(req: Request, db: DbClient, url: URL): Promise<Response> {
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
    p_radius_m: Math.min(5000, Math.floor(radiusM))
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
      activeTo: row.active_to ?? undefined
    }))
  });
}

async function handleComplete(
  req: Request,
  db: DbClient,
  userId: string
): Promise<Response> {
  const body = await readJsonBody(req);

  const questId = body.questId;
  const occurredAt = body.occurredAt;
  const location = body.location;
  const deviceEventId = body.deviceEventId;

  if (typeof questId !== "string" || typeof occurredAt !== "string" || typeof deviceEventId !== "string") {
    return errorResponse(400, "questId, occurredAt and deviceEventId are required string fields");
  }

  if (!location || typeof location !== "object") {
    return errorResponse(400, "location must be an object");
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

  const { data, error } = await db.rpc("complete_quest", {
    p_user_id: userId,
    p_quest_id: questId,
    p_occurred_at: occurredAt,
    p_location: location,
    p_device_event_id: deviceEventId,
    p_request_ip: ip
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleSocialFeed(
  db: DbClient,
  userId: string,
  url: URL
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
    p_cursor: cursor
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  const events = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    payload: row.payload_json,
    createdAt: row.created_at
  }));

  const nextCursor = events.length === Math.min(100, Math.floor(limit)) ? events.at(-1)?.createdAt : undefined;

  return jsonResponse({ events, nextCursor });
}

async function handleFriendRequest(
  req: Request,
  db: DbClient,
  userId: string
): Promise<Response> {
  const body = await readJsonBody(req);
  const receiverUserId = body.receiverUserId;

  if (typeof receiverUserId !== "string") {
    return errorResponse(400, "receiverUserId is required");
  }

  const { data, error } = await db.rpc("request_friend", {
    p_sender_user_id: userId,
    p_receiver_user_id: receiverUserId
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleFriendAccept(
  req: Request,
  db: DbClient,
  userId: string
): Promise<Response> {
  const body = await readJsonBody(req);
  const requestId = body.requestId;

  if (typeof requestId !== "string") {
    return errorResponse(400, "requestId is required");
  }

  const { data, error } = await db.rpc("accept_friend_request", {
    p_request_id: requestId,
    p_receiver_user_id: userId
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return jsonResponse(data);
}

async function handleProfileCompare(
  db: DbClient,
  userId: string,
  url: URL
): Promise<Response> {
  const friendUserId = url.searchParams.get("friendUserId");
  if (!friendUserId) {
    return errorResponse(400, "friendUserId is required");
  }

  const { data, error } = await db.rpc("profile_compare", {
    p_user_id: userId,
    p_friend_user_id: friendUserId
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(403, "friendship_required");
  }

  return jsonResponse(data);
}

async function handleBootstrap(db: DbClient, url: URL): Promise<Response> {
  const cityId = parseCityId(url.searchParams);
  const { data, error } = await db.rpc("get_bootstrap_config", {
    p_city_id: cityId
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  if (!data) {
    return errorResponse(404, "city_not_found");
  }

  return jsonResponse(data);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let user: { id: string } | null = null;

  try {
    user = await requireAuthUser(req);
  } catch (error) {
    return errorResponse(500, `Auth client init failed: ${(error as Error).message}`);
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
    if (req.method === "GET" && route === "/quests/nearby") {
      return await handleNearby(req, db, url);
    }

    if (req.method === "POST" && route === "/quests/complete") {
      return await handleComplete(req, db, user.id);
    }

    if (req.method === "GET" && route === "/social/feed") {
      return await handleSocialFeed(db, user.id, url);
    }

    if (req.method === "POST" && route === "/social/friends/request") {
      return await handleFriendRequest(req, db, user.id);
    }

    if (req.method === "POST" && route === "/social/friends/accept") {
      return await handleFriendAccept(req, db, user.id);
    }

    if (req.method === "GET" && route === "/users/me/profile-compare") {
      return await handleProfileCompare(db, user.id, url);
    }

    if (req.method === "GET" && route === "/config/bootstrap") {
      return await handleBootstrap(db, url);
    }

    return errorResponse(404, `Unknown route: ${req.method} ${route}`);
  } catch (error) {
    return errorResponse(500, (error as Error).message);
  }
});
