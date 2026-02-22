import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { trackUiEvent } from "../src/analytics/events";
import {
  getBootstrapConfig,
  getUserSummary,
  registerPushToken,
} from "../src/api/endpoints";
import { APP_CITY_ID } from "../src/config/city";
import { useSessionStore } from "../src/state/session";
import { useOfflineSync } from "../src/hooks/useOfflineSync";
import {
  captureNonFatal,
  initSentry,
  setSentryUser,
} from "../src/observability/sentry";

let hasTrackedFirstThreeCompletions = false;

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const isBootstrapped = useSessionStore((state) => state.isBootstrapped);
  const userId = useSessionStore((state) => state.userId);
  const setNeedsOnboarding = useSessionStore((state) => state.setNeedsOnboarding);
  const { flushQueue } = useOfflineSync();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isProfileGateLoading, setIsProfileGateLoading] = useState(true);

  useEffect(() => {
    initSentry();
  }, []);

  useEffect(() => {
    setSentryUser(userId);
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setIsBootstrapping(true);
      setBootstrapError(null);
      try {
        await bootstrapSession();
      } catch (error) {
        if (!isMounted) {
          return;
        }
        captureNonFatal(error, { scope: "bootstrap_session" });
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start guest session.";
        setBootstrapError(message);
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [bootstrapSession, retryNonce]);

  useEffect(() => {
    if (!isBootstrapped) {
      setIsProfileGateLoading(true);
      return;
    }

    const interval = setInterval(() => {
      void flushQueue();
    }, 15000);

    void flushQueue();

    return () => clearInterval(interval);
  }, [flushQueue, isBootstrapped]);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    let isMounted = true;
    const run = async () => {
      setIsProfileGateLoading(true);
      try {
        const summary = await getUserSummary();
        const username = summary.user.username ?? "";
        const hasPlaceholderUsername = /^u_[a-f0-9]{20}$/i.test(username);
        if (isMounted) {
          setNeedsOnboarding(hasPlaceholderUsername);
          trackUiEvent("app_bootstrap_success", {
            needsOnboarding: hasPlaceholderUsername,
          });
          if (
            summary.stats.questsCompleted >= 3 &&
            !hasTrackedFirstThreeCompletions
          ) {
            trackUiEvent("first_3_quests_completed", {
              questsCompleted: summary.stats.questsCompleted,
            });
            hasTrackedFirstThreeCompletions = true;
          }
        }
      } catch {
        captureNonFatal(new Error("summary bootstrap failed"), {
          scope: "summary_bootstrap",
        });
        if (isMounted) {
          // Allow app usage even if summary bootstrap fails.
          setNeedsOnboarding(false);
        }
      } finally {
        if (isMounted) {
          setIsProfileGateLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [isBootstrapped, setNeedsOnboarding]);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    const run = async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }

        if (status !== "granted") {
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );

        const result = await registerPushToken({
          pushToken: tokenResponse.data,
          platform: Platform.OS === "android" ? "android" : "ios",
          appVersion: Constants.expoConfig?.version,
        });

        trackUiEvent("push_token_registered", {
          status: result.status,
          platform: result.platform,
        });
      } catch {
        captureNonFatal(new Error("push token registration failed"), {
          scope: "push_registration",
        });
        // Push registration is best-effort in MVP v1.
      }
    };

    void run();
  }, [isBootstrapped]);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    void getBootstrapConfig(APP_CITY_ID).catch((error) => {
      captureNonFatal(error, { scope: "bootstrap_config" });
      // Bootstrap config is best-effort at app load.
    });
  }, [isBootstrapped]);

  if (!isBootstrapped || isProfileGateLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        {isBootstrapping || isProfileGateLoading ? (
          <ActivityIndicator size="large" />
        ) : null}
        <View style={{ height: 12 }} />
        <Text>
          {isBootstrapped && isProfileGateLoading
            ? "Preparing your profile..."
            : isBootstrapping
            ? "Starting guest session..."
            : "Unable to start session."}
        </Text>
        {bootstrapError ? (
          <>
            <View style={{ height: 8 }} />
            <Text
              style={{
                color: "#6b7280",
                paddingHorizontal: 24,
                textAlign: "center",
              }}
            >
              {bootstrapError}
            </Text>
            <View style={{ height: 14 }} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryNonce((value) => value + 1)}
              style={{
                backgroundColor: "#111827",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
            </Pressable>
          </>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quest/[questId]" />
      </Stack>
    </QueryClientProvider>
  );
}
