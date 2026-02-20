import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  View
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { CompleteQuestRequest, Quest } from "@passport-quest/shared";
import { completeQuest, getNearbyQuests } from "../../src/api/endpoints";
import { enqueueQuestCompletion } from "../../src/db/offlineQueue";
import { useSessionStore } from "../../src/state/session";

export default function QuestScreen() {
  const queryClient = useQueryClient();
  const cityId = useSessionStore((state) => state.activeCityId);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const radiusM = 1200;

  useEffect(() => {
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location required", "Allow location to fetch nearby quests.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? 999
      });
    })();
  }, []);

  const nearbyQuery = useQuery({
    queryKey: ["nearby-quests", cityId, coords?.lat, coords?.lng, radiusM],
    enabled: coords !== null,
    queryFn: () =>
      getNearbyQuests({
        cityId,
        lat: coords!.lat,
        lng: coords!.lng,
        radiusM
      })
  });

  const completeMutation = useMutation({
    mutationFn: async (quest: Quest) => {
      if (!coords) {
        throw new Error("No location available");
      }

      const payload: CompleteQuestRequest = {
        questId: quest.id,
        occurredAt: new Date().toISOString(),
        location: {
          lat: coords.lat,
          lng: coords.lng,
          accuracyM: coords.accuracyM
        },
        deviceEventId: `${Date.now()}-${Math.random().toString(16).slice(2)}`
      };

      try {
        return await completeQuest(payload);
      } catch {
        await enqueueQuestCompletion(payload);
        return {
          status: "accepted",
          reason: "queued_offline"
        } as const;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nearby-quests", cityId] });
    }
  });

  const region = useMemo(
    () =>
      coords
        ? {
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02
          }
        : undefined,
    [coords]
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Nearby Quests ({cityId.toUpperCase()})</Text>
      {region ? (
        <View style={{ height: 220, borderRadius: 12, overflow: "hidden" }}>
          <MapView style={{ flex: 1 }} initialRegion={region}>
            <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title="You" />
          </MapView>
        </View>
      ) : (
        <Text>Getting GPS fix...</Text>
      )}

      {nearbyQuery.isLoading && <Text>Loading quests...</Text>}
      {nearbyQuery.error && <Text>Failed to load quests: {(nearbyQuery.error as Error).message}</Text>}

      <FlatList
        data={nearbyQuery.data?.quests ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              backgroundColor: "white"
            }}
            onPress={() => completeMutation.mutate(item)}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: "#555", marginTop: 4 }}>{item.description}</Text>
            <Text style={{ marginTop: 6 }}>Reward: {item.xpReward} XP</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          nearbyQuery.isSuccess ? <Text>No quests near current location.</Text> : null
        }
      />

      {completeMutation.isPending && <Text>Submitting completion...</Text>}
      {completeMutation.data && (
        <Text>
          Last completion: {completeMutation.data.status}
          {completeMutation.data.reason ? ` (${completeMutation.data.reason})` : ""}
        </Text>
      )}
    </SafeAreaView>
  );
}
