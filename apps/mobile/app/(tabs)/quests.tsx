import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Quest } from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import { getNearbyQuests, getUserSummary } from "../../src/api/endpoints";
import { APP_CITY_ANCHOR, APP_CITY_ID } from "../../src/config/city";
import { useLocationOverrideStore } from "../../src/state/locationOverride";
import { useOfflineSyncState } from "../../src/state/offlineSync";
import { theme } from "../../src/theme";
import {
  EmptyState,
  GlassCard,
  InlineError,
  LoadingShimmer,
  QuestMiniCard,
  ScreenContainer,
  TopBar,
} from "../../src/ui";

function openQuestDetail(
  quest: Quest,
  source: "nearby" | "recommended" = "nearby",
  action: "opened" | "started" = "opened",
) {
  trackUiEvent("map_open_quest", {
    questId: quest.id,
    cityId: quest.cityId,
    source: `${source}_quests_tab`,
  });
  if (source === "recommended") {
    trackUiEvent(
      action === "started"
        ? "recommended_quest_started"
        : "recommended_quest_opened",
      {
        questId: quest.id,
        cityId: quest.cityId,
        surface: "quests_tab",
      },
    );
  }
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
      source,
    },
  });
}

export default function QuestsScreen() {
  const cityId = APP_CITY_ID;
  const cityAnchor = APP_CITY_ANCHOR;
  const locationOverride = useLocationOverrideStore((state) => state.override);
  const setLocationOverride = useLocationOverrideStore((state) => state.setOverride);
  const pendingCount = useOfflineSyncState((state) => state.pendingCount);
  const isSyncing = useOfflineSyncState((state) => state.isSyncing);
  const lastSyncAt = useOfflineSyncState((state) => state.lastSyncAt);
  const lastError = useOfflineSyncState((state) => state.lastError);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const trackedRecommendedImpressionsRef = useRef<Set<string>>(new Set());

  const requestDeviceLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setCoords({
        lat: locationOverride?.lat ?? cityAnchor.lat,
        lng: locationOverride?.lng ?? cityAnchor.lng,
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
      });
    } catch {
      setCoords({
        lat: locationOverride?.lat ?? cityAnchor.lat,
        lng: locationOverride?.lng ?? cityAnchor.lng,
      });
    }
  }, [cityAnchor.lat, cityAnchor.lng, locationOverride?.lat, locationOverride?.lng]);

  useEffect(() => {
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const nearbyQuery = useQuery({
    queryKey: ["nearby-quests", cityId, coords?.lat, coords?.lng, 1600],
    enabled: coords !== null,
    queryFn: () =>
      getNearbyQuests({
        cityId,
        lat: coords!.lat,
        lng: coords!.lng,
        radiusM: 1600,
      }),
  });

  const nearbyQuests = nearbyQuery.data?.quests ?? [];
  const suggestedQuests = useMemo(
    () =>
      nearbyQuests.slice(0, 3).map((quest) => ({
        ...quest,
        description: `${quest.description} Stay close to this zone for accurate check-in.`,
      })),
    [nearbyQuests],
  );

  useEffect(() => {
    for (const quest of suggestedQuests) {
      if (trackedRecommendedImpressionsRef.current.has(quest.id)) {
        continue;
      }
      trackedRecommendedImpressionsRef.current.add(quest.id);
      trackUiEvent("recommended_quest_impression", {
        questId: quest.id,
        cityId: quest.cityId,
        surface: "quests_tab",
      });
    }
  }, [suggestedQuests]);

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Quests" subtitle={cityAnchor.label} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.cityActionsCard}>
          <Text style={styles.cityInfoLabel}>
            Active city:{" "}
            <Text style={styles.cityInfoValue}>{cityAnchor.label}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLocationOverride({
                lat: cityAnchor.lat,
                lng: cityAnchor.lng,
                accuracyM: 8,
                source: "app_test_location",
              });
              setCoords({ lat: cityAnchor.lat, lng: cityAnchor.lng });
              trackUiEvent("map_use_test_location", {
                cityId,
                source: "quests_tab",
              });
            }}
            style={styles.cityActionButton}
          >
            <Text style={styles.cityActionLabel}>
              Use {cityAnchor.label} test location
            </Text>
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.syncCard}>
          <Text style={styles.syncTitle}>Offline Sync</Text>
          <Text style={styles.syncMeta}>Pending completions: {pendingCount}</Text>
          <Text style={styles.syncMeta}>
            Status: {isSyncing ? "Syncing" : "Idle"}
          </Text>
          <Text style={styles.syncMeta}>
            Last sync:{" "}
            {lastSyncAt
              ? new Date(lastSyncAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "No sync yet"}
          </Text>
          {lastError === "offline" ? (
            <Text style={styles.syncWarning}>
              No internet. Sync resumes automatically.
            </Text>
          ) : null}
        </GlassCard>

        <Text style={styles.sectionTitle}>Nearby</Text>
        {nearbyQuery.isLoading ? (
          <LoadingShimmer label="Loading nearby quests..." />
        ) : null}
        {nearbyQuery.error ? (
          <InlineError
            message={`Could not load nearby quests. ${String((nearbyQuery.error as Error).message)}`}
          />
        ) : null}
        {nearbyQuery.isSuccess && nearbyQuests.length === 0 ? (
          <EmptyState
            title="No quests in this area yet"
            description="Try another spot."
          />
        ) : null}
        {nearbyQuests.map((quest) => (
          <QuestMiniCard
            key={`nearby-${quest.id}`}
            quest={{
              id: quest.id,
              title: quest.title,
              subtitle: quest.description,
              xpReward: quest.xpReward,
              badgeLabel: quest.badgeKey
                ? `${quest.badgeKey} Badge`
                : undefined,
              category: quest.category,
              status: "nearby",
            }}
            compact
            ctaLabel="View Details"
            onPress={() => openQuestDetail(quest)}
            onStart={() => openQuestDetail(quest)}
          />
        ))}

        <Text style={styles.sectionTitle}>Suggested</Text>
        {suggestedQuests.length === 0 ? (
          <EmptyState
            title="Suggestions coming soon"
            description="Complete nearby quests first and we will suggest your next run."
          />
        ) : (
          suggestedQuests.map((quest) => (
            <QuestMiniCard
              key={`suggested-${quest.id}`}
              quest={{
                id: quest.id,
                title: quest.title,
                subtitle: quest.description,
                xpReward: quest.xpReward,
                badgeLabel: quest.badgeKey
                  ? `${quest.badgeKey} Badge`
                  : undefined,
                category: quest.category,
                status: "suggested",
              }}
              compact
              ctaLabel="View Details"
              onPress={() => openQuestDetail(quest, "recommended", "opened")}
              onStart={() => openQuestDetail(quest, "recommended", "started")}
            />
          ))
        )}

        {summaryQuery.data ? (
          <>
            <Text style={styles.sectionTitle}>Completed</Text>
            <GlassCard>
              <Text style={styles.completedCount}>
                {summaryQuery.data.stats.questsCompleted}
              </Text>
              <Text style={styles.completedLabel}>Quests Completed</Text>
            </GlassCard>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.sm,
  },
  cityActionsCard: {
    gap: theme.spacing.sm,
  },
  cityInfoLabel: {
    color: theme.colors.textSecondary,
  },
  cityInfoValue: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  cityActionButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    alignSelf: "flex-start",
  },
  cityActionLabel: {
    color: theme.colors.accentCyan,
    fontWeight: "700",
  },
  syncCard: {
    gap: theme.spacing.xs,
  },
  syncTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  syncMeta: {
    color: theme.colors.textSecondary,
  },
  syncWarning: {
    color: theme.colors.warning,
    fontWeight: "600",
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginTop: theme.spacing.sm,
  },
  completedCount: {
    color: theme.colors.accentGreen,
    fontSize: 30,
    fontWeight: "800",
  },
  completedLabel: {
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
