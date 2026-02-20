import type {
  BootstrapConfig,
  CompleteQuestRequest,
  CompleteQuestResponse,
  NearbyQuestResponse,
  ProfileCompareResponse,
  SocialFeedResponse
} from "@passport-quest/shared";
import { apiRequest } from "./http";

export function getNearbyQuests(params: {
  cityId: "blr" | "nyc";
  lat: number;
  lng: number;
  radiusM: number;
}) {
  return apiRequest<NearbyQuestResponse>({
    method: "GET",
    path: "/quests/nearby",
    query: params
  });
}

export function completeQuest(payload: CompleteQuestRequest) {
  return apiRequest<CompleteQuestResponse>({
    method: "POST",
    path: "/quests/complete",
    body: payload
  });
}

export function getBootstrapConfig(cityId: "blr" | "nyc") {
  return apiRequest<BootstrapConfig>({
    method: "GET",
    path: "/config/bootstrap",
    query: { cityId }
  });
}

export function getSocialFeed(limit = 20, cursor?: string) {
  return apiRequest<SocialFeedResponse>({
    method: "GET",
    path: "/social/feed",
    query: { limit, cursor }
  });
}

export function requestFriend(receiverUserId: string) {
  return apiRequest<{ status: string; requestId?: string }>({
    method: "POST",
    path: "/social/friends/request",
    body: { receiverUserId }
  });
}

export function acceptFriend(requestId: string) {
  return apiRequest<{ status: string }>({
    method: "POST",
    path: "/social/friends/accept",
    body: { requestId }
  });
}

export function getProfileCompare(friendUserId: string) {
  return apiRequest<ProfileCompareResponse>({
    method: "GET",
    path: "/users/me/profile-compare",
    query: { friendUserId }
  });
}
