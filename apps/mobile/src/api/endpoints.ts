import type {
  BootstrapConfig,
  CityId,
  CompleteQuestRequest,
  CompleteQuestResponse,
  HealthResponse,
  IncomingFriendRequestsResponse,
  NearbyQuestResponse,
  ProfileCompareResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  SocialFeedResponse,
  UpdateProfileRequest,
  UserBadgesResponse,
  UserSummaryResponse,
} from "@passport-quest/shared";
import { apiRequest } from "./http";

export function getNearbyQuests(params: {
  cityId: CityId;
  lat: number;
  lng: number;
  radiusM: number;
}) {
  return apiRequest<NearbyQuestResponse>({
    method: "GET",
    path: "/quests/nearby",
    query: params,
  });
}

export function completeQuest(payload: CompleteQuestRequest) {
  return apiRequest<CompleteQuestResponse>({
    method: "POST",
    path: "/quests/complete",
    body: payload,
  });
}

export function getBootstrapConfig(cityId: CityId) {
  return apiRequest<BootstrapConfig>({
    method: "GET",
    path: "/config/bootstrap",
    query: { cityId },
  });
}

export function getUserSummary() {
  return apiRequest<UserSummaryResponse>({
    method: "GET",
    path: "/users/me/summary",
  });
}

export function getUserBadges() {
  return apiRequest<UserBadgesResponse>({
    method: "GET",
    path: "/users/me/badges",
  });
}

export function getSocialFeed(limit = 20, cursor?: string) {
  return apiRequest<SocialFeedResponse>({
    method: "GET",
    path: "/social/feed",
    query: { limit, cursor },
  });
}

export function requestFriend(receiverUserId: string) {
  return apiRequest<{ status: string; requestId?: string }>({
    method: "POST",
    path: "/social/friends/request",
    body: { receiverUserId },
  });
}

export function requestFriendByUsername(username: string) {
  return apiRequest<{ status: string; requestId?: string; reason?: string }>({
    method: "POST",
    path: "/social/friends/request-by-username",
    body: { username },
  });
}

export function acceptFriend(requestId: string) {
  return apiRequest<{ status: string }>({
    method: "POST",
    path: "/social/friends/accept",
    body: { requestId },
  });
}

export function getIncomingFriendRequests(status: "pending" | "accepted" | "rejected" | "cancelled" = "pending") {
  return apiRequest<IncomingFriendRequestsResponse>({
    method: "GET",
    path: "/social/friend-requests/incoming",
    query: { status, limit: 30 },
  });
}

export function getProfileCompare(friendUserId: string) {
  return apiRequest<ProfileCompareResponse>({
    method: "GET",
    path: "/users/me/profile-compare",
    query: { friendUserId },
  });
}

export function updateMyProfile(payload: UpdateProfileRequest) {
  return apiRequest<UserSummaryResponse>({
    method: "PATCH",
    path: "/users/me/profile",
    body: payload,
  });
}

export function registerPushToken(payload: RegisterPushTokenRequest) {
  return apiRequest<RegisterPushTokenResponse>({
    method: "POST",
    path: "/notifications/register-token",
    body: payload,
  });
}

export function getHealth() {
  return apiRequest<HealthResponse>({
    method: "GET",
    path: "/health",
  });
}
