import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import { useSessionStore } from "../src/state/session";
import { useOfflineSync } from "../src/hooks/useOfflineSync";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const isBootstrapped = useSessionStore((state) => state.isBootstrapped);
  const { flushQueue } = useOfflineSync();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

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
        const message = error instanceof Error ? error.message : "Failed to start guest session.";
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
      return;
    }

    const interval = setInterval(() => {
      void flushQueue();
    }, 15000);

    void flushQueue();

    return () => clearInterval(interval);
  }, [flushQueue, isBootstrapped]);

  if (!isBootstrapped) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {isBootstrapping ? <ActivityIndicator size="large" /> : null}
        <View style={{ height: 12 }} />
        <Text>{isBootstrapping ? "Starting guest session..." : "Unable to start session."}</Text>
        {bootstrapError ? (
          <>
            <View style={{ height: 8 }} />
            <Text style={{ color: "#6b7280", paddingHorizontal: 24, textAlign: "center" }}>{bootstrapError}</Text>
            <View style={{ height: 14 }} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryNonce((value) => value + 1)}
              style={{
                backgroundColor: "#111827",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10
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
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
