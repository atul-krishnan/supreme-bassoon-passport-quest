import { env } from "../config/env";
import { useSessionStore } from "../state/session";

export type UiEventName =
  | "app_bootstrap_success"
  | "onboarding_completed"
  | "profile_updated"
  | "profile_compare_requested"
  | "push_token_registered"
  | "quest_completion_api_latency"
  | "offline_sync_flush"
  | "offline_sync_retry"
  | "offline_sync_success"
  | "map_open_quest"
  | "map_use_test_location"
  | "quest_claim_reward"
  | "quest_claim_queued_offline"
  | "social_send_friend_request"
  | "social_accept_friend_request"
  | "social_compare_profile_success"
  | "profile_switch_city";

function shouldSendToPosthog() {
  return Boolean(env.posthogHost && env.posthogApiKey);
}

function normalizeHost(host: string) {
  return host.endsWith("/") ? host.slice(0, -1) : host;
}

export function trackUiEvent(
  event: UiEventName,
  properties?: Record<string, unknown>,
) {
  const userId = useSessionStore.getState().userId ?? "anonymous";
  const payload = {
    event,
    properties: {
      ...(properties ?? {}),
      source: "mobile",
      distinct_id: userId,
      sentAt: new Date().toISOString(),
    },
  };

  if (__DEV__) {
    console.debug(`[analytics] ${event}`, payload.properties);
  }

  if (!shouldSendToPosthog()) {
    return;
  }

  const host = normalizeHost(env.posthogHost!);

  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: env.posthogApiKey,
      event: payload.event,
      distinct_id: userId,
      properties: payload.properties,
    }),
  }).catch(() => {
    // Telemetry must never impact gameplay flow.
  });
}
