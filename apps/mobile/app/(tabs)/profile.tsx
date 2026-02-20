import { useQuery } from "@tanstack/react-query";
import { SafeAreaView, Text, View, Pressable } from "react-native";
import { getBootstrapConfig } from "../../src/api/endpoints";
import { useSessionStore } from "../../src/state/session";

export default function ProfileScreen() {
  const cityId = useSessionStore((state) => state.activeCityId);
  const setCity = useSessionStore((state) => state.setCity);
  const userId = useSessionStore((state) => state.userId);

  const configQuery = useQuery({
    queryKey: ["bootstrap-config", cityId],
    queryFn: () => getBootstrapConfig(cityId)
  });

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Profile</Text>
      <Text style={{ marginTop: 8 }}>User: {userId}</Text>
      <Text>Active city: {cityId.toUpperCase()}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => setCity("blr")}
          style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#111" }}
        >
          <Text>Use BLR</Text>
        </Pressable>
        <Pressable
          onPress={() => setCity("nyc")}
          style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#111" }}
        >
          <Text>Use NYC (staging)</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "600" }}>Runtime Config</Text>
      {configQuery.isLoading && <Text>Loading config...</Text>}
      {configQuery.error && <Text>Failed to load config.</Text>}
      {configQuery.data && (
        <Text selectable style={{ marginTop: 8 }}>
          {JSON.stringify(configQuery.data, null, 2)}
        </Text>
      )}
    </SafeAreaView>
  );
}
