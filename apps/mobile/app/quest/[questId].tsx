import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { QuestCategory } from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import { completeQuest } from "../../src/api/endpoints";
import { enqueueQuestCompletion } from "../../src/db/offlineQueue";
import { useLocationOverrideStore } from "../../src/state/locationOverride";
import { theme } from "../../src/theme";
import {
  GlassCard,
  InlineError,
  NeonButton,
  ScreenContainer,
  TopBar,
} from "../../src/ui";
import { HERO_BY_CATEGORY } from "../../src/ui/questAssets";

type DetailParams = {
  questId?: string;
  cityId?: string;
  title?: string;
  description?: string;
  category?: QuestCategory;
  xpReward?: string;
  badgeKey?: string;
  source?: string;
};

function normalizeCategory(value: string | undefined): QuestCategory {
  if (value === "food" || value === "culture" || value === "transit") {
    return value;
  }
  return "landmark";
}

export default function QuestDetailScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<DetailParams>();
  const locationOverride = useLocationOverrideStore((state) => state.override);

  const questId = typeof params.questId === "string" ? params.questId : "";
  const title = typeof params.title === "string" ? params.title : "Quest";
  const description =
    typeof params.description === "string"
      ? params.description
      : "Explore this spot and claim your adventure reward.";
  const category = normalizeCategory(
    typeof params.category === "string" ? params.category : undefined,
  );
  const xpReward = useMemo(() => {
    const raw =
      typeof params.xpReward === "string" ? Number(params.xpReward) : 100;
    return Number.isFinite(raw) ? raw : 100;
  }, [params.xpReward]);
  const badgeKey =
    typeof params.badgeKey === "string" && params.badgeKey.length > 0
      ? params.badgeKey
      : null;
  const source = typeof params.source === "string" ? params.source : "unknown";

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!questId) {
        throw new Error("Missing quest id.");
      }

      let position:
        | {
            coords: {
              latitude: number;
              longitude: number;
              accuracy: number | null;
              speed: number | null;
            };
          }
        | Location.LocationObject;

      if (locationOverride) {
        position = {
          coords: {
            latitude: locationOverride.lat,
            longitude: locationOverride.lng,
            accuracy: locationOverride.accuracyM,
            speed: null,
          },
        };
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          throw new Error(
            "Location permission is required to claim this reward.",
          );
        }

        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      }

      const payload = {
        questId,
        occurredAt: new Date().toISOString(),
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? 999,
          speedMps: position.coords.speed ?? undefined,
        },
        deviceEventId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };

      try {
        const startedAt = Date.now();
        const result = await completeQuest(payload);
        trackUiEvent("quest_completion_api_latency", {
          questId,
          status: result.status,
          latencyMs: Date.now() - startedAt,
        });
        trackUiEvent("quest_claim_reward", { questId, status: result.status });
        if (
          source === "recommended" &&
          result.status === "accepted" &&
          result.reason !== "queued_offline"
        ) {
          trackUiEvent("recommended_quest_completed", {
            questId,
            cityId: params.cityId,
          });
        }
        return result;
      } catch (error) {
        await enqueueQuestCompletion(payload);
        trackUiEvent("quest_claim_queued_offline", { questId });
        return {
          status: "accepted",
          reason: "queued_offline",
        } as const;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nearby-quests"] }),
        queryClient.invalidateQueries({ queryKey: ["user-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["user-badges"] }),
        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
      ]);
    },
  });

  const latestMessage = completeMutation.data
    ? completeMutation.data.reason === "queued_offline"
      ? "No internet. Completion saved and will sync automatically."
      : completeMutation.data.status === "accepted"
        ? "Reward claimed. Great run."
        : completeMutation.data.status === "duplicate"
          ? "Already claimed from this check-in."
          : `Could not claim reward: ${completeMutation.data.reason ?? "validation_failed"}`
    : null;

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar
          title="Quest Detail"
          left={
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Image
          source={{ uri: HERO_BY_CATEGORY[category] }}
          style={styles.heroImage}
        />

        <GlassCard>
          <Text style={styles.challengeLabel}>CHALLENGE</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardText}>Reward: {xpReward} XP</Text>
            {badgeKey ? (
              <Text style={styles.badgeText}>{badgeKey} Badge</Text>
            ) : null}
          </View>
        </GlassCard>

        {completeMutation.error ? (
          <InlineError
            message={String((completeMutation.error as Error).message)}
          />
        ) : null}
        {latestMessage ? (
          <Text
            style={[
              styles.status,
              completeMutation.data?.reason === "queued_offline"
                ? styles.statusWarning
                : styles.statusOk,
            ]}
          >
            {latestMessage}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <NeonButton
          label="I'm Here! Claim Reward"
          onPress={() => completeMutation.mutate()}
          loading={completeMutation.isPending}
          disabled={!questId}
        />
      </View>
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
    gap: theme.spacing.md,
  },
  heroImage: {
    width: "100%",
    height: 220,
    borderRadius: theme.radius.xl,
  },
  backLabel: {
    color: theme.colors.accentCyan,
    fontWeight: "700",
  },
  challengeLabel: {
    color: theme.colors.accentGreen,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    marginTop: theme.spacing.xs,
  },
  description: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
  rewardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  rewardText: {
    color: theme.colors.accentGreen,
    fontWeight: "700",
  },
  badgeText: {
    color: theme.colors.accentCyan,
    fontWeight: "700",
  },
  status: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  statusOk: {
    color: theme.colors.success,
  },
  statusWarning: {
    color: theme.colors.warning,
  },
  footer: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.lg,
  },
});
