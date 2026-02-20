import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, SafeAreaView, Text, View } from "react-native";
import { useSessionStore } from "../src/state/session";
import { useOfflineSync } from "../src/hooks/useOfflineSync";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const isBootstrapped = useSessionStore((state) => state.isBootstrapped);
  const { flushQueue } = useOfflineSync();

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

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
        <ActivityIndicator size="large" />
        <View style={{ height: 12 }} />
        <Text>Starting guest session...</Text>
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
