import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CityId } from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import {
  getBootstrapConfig,
  getSocialFeed,
  getUserBadges,
  getUserSummary,
  updateMyProfile,
} from "../../src/api/endpoints";
import { getCityAnchor } from "../../src/config/city";
import { env } from "../../src/config/env";
import { clearOfflineQueue } from "../../src/db/offlineQueue";
import { useOfflineSync } from "../../src/hooks/useOfflineSync";
import { useLocationOverrideStore } from "../../src/state/locationOverride";
import { useOfflineSyncState } from "../../src/state/offlineSync";
import { useSessionStore } from "../../src/state/session";
import { theme } from "../../src/theme";
import { HERO_BY_CATEGORY } from "../../src/ui/questAssets";
import {
  BadgeChip,
  EmptyState,
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  ScreenContainer,
  StatTile,
  TopBar,
  XPBar,
} from "../../src/ui";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

type RecentQuestReward = {
  eventId: string;
  questId: string;
  questTitle: string;
  xpAwarded: number;
  cityId: CityId;
  createdAt: string;
};

function formatSyncTime(iso: string | null): string {
  if (!iso) {
    return "No sync yet";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "No sync yet";
  }
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeActivityTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return "Just now";
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`;
  }
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

function parseRecentQuestReward(
  events: Array<{
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }> | undefined,
): RecentQuestReward | null {
  if (!events) {
    return null;
  }

  for (const event of events) {
    if (event.eventType !== "quest_completed") {
      continue;
    }

    const payload = event.payload ?? {};
    const rawXp = Number(payload.xpAwarded ?? 50);
    const questId = typeof payload.questId === "string" ? payload.questId : "unknown";
    const cityId: CityId =
      payload.cityId === "nyc" ||
      payload.cityId === "del" ||
      payload.cityId === "pnq"
        ? payload.cityId
        : "blr";

    return {
      eventId: event.id,
      questId,
      questTitle:
        typeof payload.questTitle === "string" && payload.questTitle.trim().length > 0
          ? payload.questTitle.trim()
          : `${getCityAnchor(cityId).label} Quest Run`,
      xpAwarded: Number.isFinite(rawXp) ? Math.max(0, Math.floor(rawXp)) : 50,
      cityId,
      createdAt: event.createdAt,
    };
  }

  return null;
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { flushQueue } = useOfflineSync();
  const userId = useSessionStore((state) => state.userId);
  const activeCityId = useSessionStore((state) => state.activeCityId);
  const setCity = useSessionStore((state) => state.setCity);
  const resetSession = useSessionStore((state) => state.resetSession);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const locationOverride = useLocationOverrideStore((state) => state.override);
  const setLocationOverride = useLocationOverrideStore((state) => state.setOverride);
  const clearLocationOverride = useLocationOverrideStore((state) => state.clearOverride);
  const cityAnchor = getCityAnchor(activeCityId);

  const pendingCount = useOfflineSyncState((state) => state.pendingCount);
  const isSyncing = useOfflineSyncState((state) => state.isSyncing);
  const lastSyncAt = useOfflineSyncState((state) => state.lastSyncAt);
  const lastError = useOfflineSyncState((state) => state.lastError);
  const setPendingCount = useOfflineSyncState((state) => state.setPendingCount);
  const setLastError = useOfflineSyncState((state) => state.setLastError);

  const [isEditing, setIsEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [qaStatus, setQaStatus] = useState<string | null>(null);
  const [qaBusy, setQaBusy] = useState<null | "sync" | "clear" | "session">(null);
  const [showQaCityControls, setShowQaCityControls] = useState(false);
  const [claimedRewardEventIds, setClaimedRewardEventIds] = useState<string[]>([]);

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const badgesQuery = useQuery({
    queryKey: ["user-badges"],
    queryFn: () => getUserBadges(),
  });

  const configQuery = useQuery({
    queryKey: ["bootstrap-config", activeCityId],
    queryFn: () => getBootstrapConfig(activeCityId),
  });

  const socialFeedQuery = useQuery({
    queryKey: ["social-feed", "profile-recent"],
    queryFn: () => getSocialFeed(10),
  });

  useEffect(() => {
    if (!summaryQuery.data || isEditing) {
      return;
    }

    setUsernameDraft(summaryQuery.data.user.username ?? "");
    setAvatarDraft(summaryQuery.data.user.avatarUrl ?? "");
  }, [isEditing, summaryQuery.data]);

  const profileMutation = useMutation({
    mutationFn: async () =>
      updateMyProfile({
        username: usernameDraft.trim(),
        avatarUrl: avatarDraft.trim().length > 0 ? avatarDraft.trim() : null,
      }),
    onSuccess: async () => {
      trackUiEvent("profile_updated");
      setStatusMessage("✅ Profile updated");
      setIsEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
      ]);
    },
    onError: (error) => {
      setStatusMessage(
        error instanceof Error ? error.message : "❌ Could not update profile.",
      );
    },
  });

  const summary = summaryQuery.data;
  const badges = badgesQuery.data?.badges ?? [];
  const unlockedBadges = badges.filter((item) => item.unlocked);

  const experimentVariants = useMemo(() => {
    return configQuery.data?.experiments
      ? Object.entries(configQuery.data.experiments)
      : [];
  }, [configQuery.data?.experiments]);

  const recentQuestReward = useMemo(
    () => parseRecentQuestReward(socialFeedQuery.data?.events),
    [socialFeedQuery.data?.events],
  );

  const isRecentRewardClaimed =
    recentQuestReward !== null &&
    claimedRewardEventIds.includes(recentQuestReward.eventId);

  const runQaAction = async (
    action: "sync" | "clear" | "session",
    handler: () => Promise<void>,
  ) => {
    setQaBusy(action);
    setQaStatus(null);
    try {
      await handler();
    } catch (error) {
      setQaStatus(error instanceof Error ? error.message : "Action failed");
    } finally {
      setQaBusy(null);
    }
  };

  const claimRecentReward = async () => {
    if (!recentQuestReward || isRecentRewardClaimed) {
      return;
    }

    setClaimedRewardEventIds((current) => [
      recentQuestReward.eventId,
      ...current,
    ]);
    setStatusMessage(`✨ Reward claimed: +${recentQuestReward.xpAwarded} XP`);
    trackUiEvent("quest_claim_reward", {
      questId: recentQuestReward.questId,
      cityId: recentQuestReward.cityId,
      source: "profile_recent_activity",
    });

    await queryClient.invalidateQueries({ queryKey: ["user-summary"] });
  };

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Profile" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summaryQuery.isLoading ? <LoadingShimmer label="Loading profile..." /> : null}
        {summaryQuery.error ? <InlineError message="Could not load profile summary." /> : null}

        {summary ? (
          <GlassCard>
            <View style={styles.profileHead}>
              {summary.user.avatarUrl ? (
                <View style={styles.avatarBorder}>
                  <Image source={{ uri: summary.user.avatarUrl }} style={styles.avatar} />
                </View>
              ) : (
                <View style={styles.avatarBorder}>
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {summary.user.username.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{summary.user.username}</Text>
                <Text style={styles.levelLabel}>
                  🏅 Explorer Level {summary.stats.level}
                </Text>
              </View>
            </View>
            <View style={{ height: theme.spacing.sm }} />
            <XPBar
              value={summary.stats.xpTotal}
              max={Math.max(100, summary.stats.level * 200)}
              label="Journey Progress"
            />

            <View style={{ height: theme.spacing.sm }} />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStatusMessage(null);
                setIsEditing((current) => !current);
              }}
              style={styles.editToggle}
            >
              <Ionicons
                name={isEditing ? "close-outline" : "create-outline"}
                size={18}
                color={theme.colors.accentCyan}
              />
              <Text style={styles.editToggleLabel}>
                {isEditing ? "Cancel Edit" : "Edit Profile"}
              </Text>
            </Pressable>

            {isEditing ? (
              <View style={styles.editForm}>
                <TextInput
                  value={usernameDraft}
                  onChangeText={setUsernameDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={32}
                  placeholder="👤 Username"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={avatarDraft}
                  onChangeText={setAvatarDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="🖼️ Avatar URL (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
                <NeonButton
                  label="💾 Save Profile"
                  loading={profileMutation.isPending}
                  disabled={!USERNAME_PATTERN.test(usernameDraft.trim())}
                  onPress={() => profileMutation.mutate()}
                />
              </View>
            ) : null}

            {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
          </GlassCard>
        ) : null}

        <Text style={styles.sectionTitle}>⚡ Recent Activity</Text>
        {socialFeedQuery.isLoading ? (
          <LoadingShimmer label="Loading your latest quest..." />
        ) : null}
        {socialFeedQuery.error ? (
          <InlineError message="Could not load recent activity." />
        ) : null}
        {recentQuestReward ? (
          <GlassCard style={styles.recentActivityCard}>
            <View style={styles.recentActivityRow}>
              <Image
                source={{ uri: HERO_BY_CATEGORY.landmark }}
                style={styles.recentActivityImage}
              />
              <View style={styles.recentActivityMeta}>
                <Text style={styles.recentActivityTitle}>
                  {recentQuestReward.questTitle}
                </Text>
                <Text style={styles.recentActivityReward}>
                  +{recentQuestReward.xpAwarded} XP Earned
                </Text>
                <Text style={styles.recentActivityTime}>
                  {formatRelativeActivityTime(recentQuestReward.createdAt)}
                </Text>
              </View>
            </View>
            <NeonButton
              label={isRecentRewardClaimed ? "Reward Claimed" : "Claim Reward"}
              onPress={() => void claimRecentReward()}
              disabled={isRecentRewardClaimed}
              style={styles.recentActivityButton}
            />
          </GlassCard>
        ) : null}
        {socialFeedQuery.isSuccess && !recentQuestReward ? (
          <EmptyState
            title="No reward waiting"
            description="Complete a quest and claim from here instantly."
            icon="sparkles-outline"
          />
        ) : null}

        <Text style={styles.sectionTitle}>🏆 Badge Case</Text>
        {badgesQuery.isLoading ? <LoadingShimmer label="Loading badge cabinet..." /> : null}
        {badgesQuery.error ? <InlineError message="Could not load badges right now." /> : null}
        {badgesQuery.isSuccess && badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            description="Complete more quests to unlock badges."
            icon="ribbon-outline"
          />
        ) : null}
        {badges.length > 0 ? (
          <GlassCard>
            <View style={styles.badgeGrid}>
              {badges.map((badge) => (
                <BadgeChip
                  key={badge.key}
                  label={badge.name}
                  unlocked={badge.unlocked}
                />
              ))}
            </View>
            <Text style={styles.lockedHint}>
              {unlockedBadges.length === 0
                ? "🎮 Complete quests to unlock your first badge!"
                : `${unlockedBadges.length} unlocked • ${badges.length - unlockedBadges.length} remaining`}
            </Text>
          </GlassCard>
        ) : null}

        {summary ? (
          <>
            <Text style={styles.sectionTitle}>📈 Your Stats</Text>
            <View style={styles.statsRow}>
              <StatTile
                label="Quests"
                value={summary.stats.questsCompleted}
                icon="checkmark-done-outline"
                iconColor={theme.colors.accentGreen}
              />
              <StatTile
                label="Streak"
                value={summary.stats.streakDays}
                icon="flame-outline"
                iconColor={theme.colors.warning}
              />
              <StatTile
                label="XP Total"
                value={summary.stats.xpTotal}
                icon="star-outline"
                iconColor={theme.colors.accentCyan}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>🔄 Offline Sync</Text>
        <GlassCard style={styles.syncCard}>
          <View style={styles.syncRow}>
            <Ionicons name="cloud-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.syncLabel}>Pending completions: {pendingCount}</Text>
          </View>
          <Text style={styles.syncMeta}>Status: {isSyncing ? "🔄 Syncing" : "✅ Idle"}</Text>
          <Text style={styles.syncMeta}>Last sync: {formatSyncTime(lastSyncAt)}</Text>
          {lastError === "offline" ? (
            <Text style={styles.syncWarning}>⚠️ No internet. Sync resumes automatically.</Text>
          ) : null}
        </GlassCard>

        <Text style={styles.sectionTitle}>🏙️ Pilot City</Text>
        <GlassCard style={styles.cityCard}>
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={20} color={theme.colors.accentCyan} />
            <Text style={styles.cityLabel}>
              Active city: {cityAnchor.label} ({activeCityId.toUpperCase()})
            </Text>
          </View>

          {configQuery.data ? (
            <Text style={styles.runtimeHint}>
              🌙 Quiet hours: {configQuery.data.quietHours.startLocal} to{" "}
              {configQuery.data.quietHours.endLocal} ({configQuery.data.timeZone})
            </Text>
          ) : null}
          {configQuery.data?.notificationPolicy ? (
            <Text style={styles.runtimeHint}>
              🔔 Notifications: {configQuery.data.notificationPolicy.suppressNow ? "Quiet hours" : "Allowed"}
            </Text>
          ) : null}
          {experimentVariants.length > 0 ? (
            <Text style={styles.runtimeHint}>
              🧪 Experiment: {experimentVariants[0][0]}={experimentVariants[0][1]}
            </Text>
          ) : null}
          {summary ? (
            <Text style={styles.runtimeHint}>
              🏆 Unlocked badges: {unlockedBadges.length}
            </Text>
          ) : null}
        </GlassCard>

        {env.appEnv !== "production" ? (
          <>
            <Text style={styles.sectionTitle}>🔧 QA Mode</Text>
            <GlassCard style={styles.qaCard}>
              <Text style={styles.qaTitle}>⚙️ Runtime</Text>
              <Text style={styles.qaMeta}>Env: {env.appEnv}</Text>
              <Text style={styles.qaMeta}>Release: {env.releaseSha ?? "local-dev"}</Text>
              <Text style={styles.qaMeta}>User: {userId ?? "anonymous"}</Text>
              <Text style={styles.qaMeta}>City: {activeCityId}</Text>
              <Text style={styles.qaMeta}>
                Experiment:{" "}
                {experimentVariants.length > 0
                  ? `${experimentVariants[0][0]}=${experimentVariants[0][1]}`
                  : "n/a"}
              </Text>
              <Text style={styles.qaMeta}>Pending queue: {pendingCount}</Text>
              <Text style={styles.qaMeta}>
                Test location: {locationOverride ? "✅ enabled" : "❌ disabled"}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowQaCityControls((value) => !value)}
                style={styles.qaCityToggle}
              >
                <Text style={styles.qaCityToggleLabel}>
                  {showQaCityControls
                    ? "Hide city switcher"
                    : "Show city switcher (QA only)"}
                </Text>
              </Pressable>

              {showQaCityControls ? (
                <View style={styles.qaCityRow}>
                  <NeonButton
                    label="📍 Bangalore"
                    variant={activeCityId === "blr" ? "primary" : "secondary"}
                    onPress={() => {
                      if (activeCityId === "blr") {
                        return;
                      }
                      setCity("blr");
                      trackUiEvent("profile_switch_city", {
                        cityId: "blr",
                        source: "qa_mode",
                      });
                      setQaStatus("QA city switched to Bangalore");
                    }}
                  />
                  <NeonButton
                    label="🗽 New York"
                    variant={activeCityId === "nyc" ? "primary" : "secondary"}
                    onPress={() => {
                      if (activeCityId === "nyc") {
                        return;
                      }
                      setCity("nyc");
                      trackUiEvent("profile_switch_city", {
                        cityId: "nyc",
                        source: "qa_mode",
                      });
                      setQaStatus("QA city switched to New York");
                    }}
                  />
                </View>
              ) : null}

              <View style={styles.qaActionsRow}>
                <NeonButton
                  label="🔄 Force Sync"
                  variant="secondary"
                  loading={qaBusy === "sync"}
                  onPress={() =>
                    void runQaAction("sync", async () => {
                      await flushQueue();
                      setQaStatus("Offline queue flush complete");
                    })
                  }
                />
                <NeonButton
                  label="🗑️ Clear Queue"
                  variant="secondary"
                  loading={qaBusy === "clear"}
                  onPress={() =>
                    void runQaAction("clear", async () => {
                      await clearOfflineQueue();
                      setPendingCount(0);
                      setLastError(null);
                      setQaStatus("Offline queue cleared");
                    })
                  }
                />
              </View>

              <View style={styles.qaActionsRow}>
                <NeonButton
                  label={
                    locationOverride
                      ? "📍 Disable Test Location"
                      : "📍 Enable Test Location"
                  }
                  variant="secondary"
                  onPress={() => {
                    if (locationOverride) {
                      clearLocationOverride();
                      setQaStatus("Test location disabled");
                      return;
                    }
                    setLocationOverride({
                      lat: cityAnchor.lat,
                      lng: cityAnchor.lng,
                      accuracyM: 8,
                      source: "app_test_location",
                    });
                    trackUiEvent("map_use_test_location", {
                      cityId: activeCityId,
                      source: "qa_mode",
                    });
                    setQaStatus("Test location enabled");
                  }}
                />
                <NeonButton
                  label="🔄 Reset Session"
                  variant="secondary"
                  loading={qaBusy === "session"}
                  onPress={() =>
                    void runQaAction("session", async () => {
                      await resetSession();
                      await bootstrapSession();
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["user-summary"] }),
                        queryClient.invalidateQueries({ queryKey: ["user-badges"] }),
                        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
                      ]);
                      setQaStatus("Session reset complete");
                    })
                  }
                />
              </View>

              {qaStatus ? <Text style={styles.qaStatus}>{qaStatus}</Text> : null}
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
    paddingBottom: 128,
    gap: theme.spacing.md,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  avatarBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: theme.colors.accentCyan,
    padding: 2,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#213565",
  },
  avatarFallbackText: {
    color: theme.colors.accentCyan,
    fontSize: 24,
    fontWeight: "800",
  },
  username: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  levelLabel: {
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  editToggle: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editToggleLabel: {
    color: theme.colors.accentCyan,
    fontWeight: "700",
  },
  editForm: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.backgroundElevated,
  },
  statusMessage: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  recentActivityCard: {
    gap: theme.spacing.sm,
  },
  recentActivityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  recentActivityImage: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(121, 167, 233, 0.28)",
  },
  recentActivityMeta: {
    flex: 1,
    gap: 2,
  },
  recentActivityTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },
  recentActivityReward: {
    color: theme.colors.primaryAction,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  recentActivityTime: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  recentActivityButton: {
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: theme.spacing.sm,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  lockedHint: {
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  syncCard: {
    gap: theme.spacing.xs,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncLabel: {
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
  cityCard: {
    gap: theme.spacing.sm,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cityLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  runtimeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
  },
  qaCard: {
    gap: theme.spacing.xs,
  },
  qaTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  qaMeta: {
    color: theme.colors.textSecondary,
  },
  qaCityToggle: {
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    alignSelf: "flex-start",
  },
  qaCityToggleLabel: {
    color: theme.colors.accentCyan,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  qaCityRow: {
    marginTop: theme.spacing.xs,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  qaActionsRow: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  qaStatus: {
    marginTop: theme.spacing.xs,
    color: theme.colors.accentCyan,
    fontWeight: "600",
  },
});
