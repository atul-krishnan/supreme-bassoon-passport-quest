import type {
  BootstrapConfig,
  CityId,
  FlowDiagnosticRequest,
  FlowDiagnosticResponse,
  FlowStateSummaryResponse,
  HealthResponse,
  HeroPlayResponse,
  MarkPlayStepDoneResponse,
  PlaySessionResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  StartPlaySessionRequest,
  StartPlaySessionResponse,
  UpdateProfileRequest,
  UserSummaryResponse,
} from "@passport-quest/shared";
import { apiRequest } from "./http";

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

export function saveFlowDiagnostic(payload: FlowDiagnosticRequest) {
  return apiRequest<FlowDiagnosticResponse>({
    method: "POST",
    path: "/flowstate/diagnostic",
    body: payload,
  });
}

export function getHeroPlay(cityId?: CityId) {
  return apiRequest<HeroPlayResponse>({
    method: "GET",
    path: "/flowstate/play/hero",
    query: cityId ? { cityId } : undefined,
  });
}

export function startPlaySession(payload: StartPlaySessionRequest) {
  return apiRequest<StartPlaySessionResponse>({
    method: "POST",
    path: "/flowstate/play/start",
    body: payload,
  });
}

export function getPlaySession(sessionId: string) {
  return apiRequest<PlaySessionResponse>({
    method: "GET",
    path: `/flowstate/play/sessions/${encodeURIComponent(sessionId)}`,
  });
}

export function markPlayStepDone(sessionId: string, stepOrder: number) {
  return apiRequest<MarkPlayStepDoneResponse>({
    method: "POST",
    path: `/flowstate/play/sessions/${encodeURIComponent(sessionId)}/steps/${stepOrder}/done`,
  });
}

export function getFlowStateSummary() {
  return apiRequest<FlowStateSummaryResponse>({
    method: "GET",
    path: "/flowstate/summary",
  });
}
