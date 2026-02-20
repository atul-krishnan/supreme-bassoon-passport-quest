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
import type { CityId, CompleteQuestRequest, Quest } from "@passport-quest/shared";
import { completeQuest, getNearbyQuests } from "../../src/api/endpoints";
import { enqueueQuestCompletion } from "../../src/db/offlineQueue";
import { useSessionStore } from "../../src/state/session";

const CITY_TEST_COORDS: Record<CityId, { lat: number; lng: number; label: string }> = {
  blr: { lat: 12.9763, lng: 77.5929, label: "Bangalore" },
  nyc: { lat: 40.7536, lng: -73.9832, label: "New York City" }
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

export default function QuestScreen() {
  const queryClient = useQueryClient();
  const cityId = useSessionStore((state) => state.activeCityId);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const radiusM = 1200;
  const cityAnchor = CITY_TEST_COORDS[cityId];
  const distanceFromCityAnchorM =
    coords === null ? null : haversineMeters(coords.lat, coords.lng, cityAnchor.lat, cityAnchor.lng);
  const isFarFromSelectedCity = distanceFromCityAnchorM !== null && distanceFromCityAnchorM > 100000;

  const requestDeviceLocation = async () => {
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
  };

  useEffect(() => {
    void requestDeviceLocation();
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
      {isFarFromSelectedCity ? (
        <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10 }}>
          <Text style={{ color: "#92400E" }}>
            Your simulator location is far from {cityAnchor.label}. Use the test location button below.
          </Text>
        </View>
      ) : null}
      {__DEV__ ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() =>
              setCoords({
                lat: cityAnchor.lat,
                lng: cityAnchor.lng,
                accuracyM: 8
              })
            }
            style={{
              backgroundColor: "#111827",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Use {cityAnchor.label} test location</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void requestDeviceLocation();
            }}
            style={{
              backgroundColor: "#E5E7EB",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8
            }}
          >
            <Text style={{ color: "#111827", fontWeight: "600" }}>Use device location</Text>
          </Pressable>
        </View>
      ) : null}
      {region ? (
        <View style={{ height: 220, borderRadius: 12, overflow: "hidden" }}>
          <MapView style={{ flex: 1 }} region={region}>
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
