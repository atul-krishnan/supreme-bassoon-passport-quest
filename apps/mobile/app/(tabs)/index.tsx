import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Quest } from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import { getNearbyQuests, getUserSummary } from "../../src/api/endpoints";
import { APP_CITY_ANCHOR, APP_CITY_ID } from "../../src/config/city";
import { useLocationOverrideStore } from "../../src/state/locationOverride";
import { theme } from "../../src/theme";
import {
  EmptyState,
  GlassCard,
  InlineError,
  LoadingShimmer,
  QuestMiniCard,
  ScreenContainer,
  TopBar,
  XPBar,
} from "../../src/ui";

const MAP_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b1024" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1024" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ea2c7" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1b2748" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9fb5dc" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071b3a" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#13203c" }],
  },
];

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

function openQuestDetail(quest: Quest) {
  trackUiEvent("map_open_quest", { questId: quest.id, cityId: quest.cityId });
  router.push({
    pathname: "/quest/[questId]",
    params: {
      questId: quest.id,
      cityId: quest.cityId,
      title: quest.title,
      description: quest.description,
      category: quest.category,
      xpReward: String(quest.xpReward),
      badgeKey: quest.badgeKey ?? "",
      geofenceLat: String(quest.geofence.lat),
      geofenceLng: String(quest.geofence.lng),
      geofenceRadiusM: String(quest.geofence.radiusM),
    },
  });
}

export default function DiscoveryMapScreen() {
  const cityId = APP_CITY_ID;
  const cityAnchor = APP_CITY_ANCHOR;
  const locationOverride = useLocationOverrideStore((state) => state.override);
  const setLocationOverride = useLocationOverrideStore((state) => state.setOverride);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracyM: number;
  } | null>(null);
  const radiusM = 1200;

  const requestDeviceLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setCoords({
        lat: locationOverride?.lat ?? cityAnchor.lat,
        lng: locationOverride?.lng ?? cityAnchor.lng,
        accuracyM: locationOverride?.accuracyM ?? 8,
      });
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? 999,
      });
    } catch {
      setCoords({
        lat: locationOverride?.lat ?? cityAnchor.lat,
        lng: locationOverride?.lng ?? cityAnchor.lng,
        accuracyM: locationOverride?.accuracyM ?? 8,
      });
    }
  }, [
    cityAnchor.lat,
    cityAnchor.lng,
    locationOverride?.accuracyM,
    locationOverride?.lat,
    locationOverride?.lng,
  ]);

  useEffect(() => {
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const nearbyQuery = useQuery({
    queryKey: ["nearby-quests", cityId, coords?.lat, coords?.lng, radiusM],
    enabled: coords !== null,
    queryFn: () =>
      getNearbyQuests({
        cityId,
        lat: coords!.lat,
        lng: coords!.lng,
        radiusM,
      }),
  });

  const distanceFromCityAnchorM =
    coords === null
      ? null
      : haversineMeters(coords.lat, coords.lng, cityAnchor.lat, cityAnchor.lng);
  const isFarFromSelectedCity =
    distanceFromCityAnchorM !== null && distanceFromCityAnchorM > 100000;

  const mapRegion = useMemo(
    () => ({
      latitude: coords?.lat ?? cityAnchor.lat,
      longitude: coords?.lng ?? cityAnchor.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }),
    [cityAnchor.lat, cityAnchor.lng, coords?.lat, coords?.lng],
  );

  const featuredQuest = nearbyQuery.data?.quests?.[0];

  const handleUseTestLocation = () => {
    setLocationOverride({
      lat: cityAnchor.lat,
      lng: cityAnchor.lng,
      accuracyM: 8,
      source: "app_test_location",
    });
    setCoords({
      lat: cityAnchor.lat,
      lng: cityAnchor.lng,
      accuracyM: 8,
    });
    trackUiEvent("map_use_test_location", { cityId });
  };

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Discovery Map" subtitle={cityAnchor.label} />
        <GlassCard>
          <XPBar
            value={summaryQuery.data?.stats.xpTotal ?? 0}
            max={Math.max(100, (summaryQuery.data?.stats.level ?? 1) * 200)}
            label={`Level ${summaryQuery.data?.stats.level ?? 1} Explorer`}
          />
        </GlassCard>
      </View>

      <View style={styles.body}>
        {isFarFromSelectedCity ? (
          <GlassCard style={styles.bannerCard}>
            <Text style={styles.bannerText}>
              You are far from {cityAnchor.label}. Use test location to preview
              nearby quests.
            </Text>
            <View style={{ height: theme.spacing.xs }} />
            <Pressable
              accessibilityRole="button"
              onPress={handleUseTestLocation}
              style={styles.bannerButton}
            >
              <Text style={styles.bannerButtonLabel}>
                Use {cityAnchor.label} test location
              </Text>
            </Pressable>
          </GlassCard>
        ) : null}

        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            customMapStyle={MAP_DARK_STYLE}
            initialRegion={mapRegion}
            region={mapRegion}
          >
            {coords ? (
              <Marker
                coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                title="You are here"
                pinColor={theme.colors.accentCyan}
              />
            ) : null}
            {(nearbyQuery.data?.quests ?? []).map((quest) => (
              <Marker
                key={quest.id}
                coordinate={{
                  latitude: Number(quest.geofence.lat),
                  longitude: Number(quest.geofence.lng),
                }}
                title={quest.title}
                description={`${quest.xpReward} XP reward`}
                pinColor={theme.colors.accentPurple}
                onCalloutPress={() => openQuestDetail(quest)}
              />
            ))}
          </MapView>
        </View>

        {nearbyQuery.isLoading ? (
          <LoadingShimmer label="Finding nearby quests..." />
        ) : null}
        {nearbyQuery.error ? (
          <InlineError
            message={`Could not load quests right now. ${String((nearbyQuery.error as Error).message)}`}
          />
        ) : null}

        {featuredQuest ? (
          <QuestMiniCard
            quest={{
              id: featuredQuest.id,
              title: featuredQuest.title,
              subtitle: featuredQuest.description,
              xpReward: featuredQuest.xpReward,
              badgeLabel: featuredQuest.badgeKey
                ? `${featuredQuest.badgeKey} Badge`
                : undefined,
              category: featuredQuest.category,
              status: "nearby",
            }}
            onPress={() => openQuestDetail(featuredQuest)}
            onStart={() => openQuestDetail(featuredQuest)}
          />
        ) : nearbyQuery.isSuccess ? (
          <EmptyState
            title="No quests nearby right now"
            description="Move around or widen your search."
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  bannerCard: {
    paddingVertical: theme.spacing.sm,
  },
  bannerText: {
    color: theme.colors.warning,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
  },
  bannerButton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  bannerButtonLabel: {
    color: theme.colors.warning,
    fontWeight: "700",
  },
  mapWrap: {
    height: 300,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  map: {
    flex: 1,
  },
});
