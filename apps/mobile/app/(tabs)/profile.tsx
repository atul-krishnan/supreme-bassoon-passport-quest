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
import { trackUiEvent } from "../../src/analytics/events";
import {
  getBootstrapConfig,
  getUserBadges,
  getUserSummary,
  updateMyProfile,
} from "../../src/api/endpoints";
import { APP_CITY_ANCHOR, APP_CITY_ID } from "../../src/config/city";
import { env } from "../../src/config/env";
import { clearOfflineQueue } from "../../src/db/offlineQueue";
import { useOfflineSync } from "../../src/hooks/useOfflineSync";
import { useLocationOverrideStore } from "../../src/state/locationOverride";
import { useOfflineSyncState } from "../../src/state/offlineSync";
import { useSessionStore } from "../../src/state/session";
import { theme } from "../../src/theme";
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

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { flushQueue } = useOfflineSync();
  const userId = useSessionStore((state) => state.userId);
  const resetSession = useSessionStore((state) => state.resetSession);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const locationOverride = useLocationOverrideStore((state) => state.override);
  const setLocationOverride = useLocationOverrideStore((state) => state.setOverride);
  const clearLocationOverride = useLocationOverrideStore((state) => state.clearOverride);

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

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const badgesQuery = useQuery({
    queryKey: ["user-badges"],
    queryFn: () => getUserBadges(),
  });

  const configQuery = useQuery({
    queryKey: ["bootstrap-config", APP_CITY_ID],
    queryFn: () => getBootstrapConfig(APP_CITY_ID),
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
      setStatusMessage("Profile updated");
      setIsEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["social-feed"] }),
      ]);
    },
    onError: (error) => {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not update profile.",
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

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Profile & Badges" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summaryQuery.isLoading ? <LoadingShimmer label="Loading profile..." /> : null}
        {summaryQuery.error ? <InlineError message="Could not load profile summary." /> : null}

        {summary ? (
          <GlassCard>
            <View style={styles.profileHead}>
              {summary.user.avatarUrl ? (
                <Image source={{ uri: summary.user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {summary.user.username.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{summary.user.username}</Text>
                <Text style={styles.levelLabel}>
                  Explorer Level {summary.stats.level}
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
                  placeholder="Username"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={avatarDraft}
                  onChangeText={setAvatarDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Avatar URL (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
                <NeonButton
                  label="Save Profile"
                  loading={profileMutation.isPending}
                  disabled={!USERNAME_PATTERN.test(usernameDraft.trim())}
                  onPress={() => profileMutation.mutate()}
                />
              </View>
            ) : null}

            {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
          </GlassCard>
        ) : null}

        <Text style={styles.sectionTitle}>Badge Case</Text>
        {badgesQuery.isLoading ? <LoadingShimmer label="Loading badge cabinet..." /> : null}
        {badgesQuery.error ? <InlineError message="Could not load badges right now." /> : null}
        {badgesQuery.isSuccess && badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            description="Complete more quests to unlock this badge."
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
              Complete more quests to unlock this badge.
            </Text>
          </GlassCard>
        ) : null}

        {summary ? (
          <>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsRow}>
              <StatTile label="Quests Completed" value={summary.stats.questsCompleted} />
              <StatTile label="Streak Days" value={summary.stats.streakDays} />
              <StatTile label="XP Total" value={summary.stats.xpTotal} />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Offline Sync</Text>
        <GlassCard style={styles.syncCard}>
          <Text style={styles.syncLabel}>Pending completions: {pendingCount}</Text>
          <Text style={styles.syncMeta}>Status: {isSyncing ? "Syncing" : "Idle"}</Text>
          <Text style={styles.syncMeta}>Last sync: {formatSyncTime(lastSyncAt)}</Text>
          {lastError === "offline" ? (
            <Text style={styles.syncWarning}>No internet. Sync resumes automatically.</Text>
          ) : null}
        </GlassCard>

        <Text style={styles.sectionTitle}>Pilot City</Text>
        <GlassCard style={styles.cityCard}>
          <Text style={styles.cityLabel}>
            Active city: {APP_CITY_ANCHOR.label} ({APP_CITY_ID.toUpperCase()})
          </Text>

          {configQuery.data ? (
            <Text style={styles.runtimeHint}>
              Quiet hours: {configQuery.data.quietHours.startLocal} to {" "}
              {configQuery.data.quietHours.endLocal} ({configQuery.data.timeZone})
            </Text>
          ) : null}
          {configQuery.data?.notificationPolicy ? (
            <Text style={styles.runtimeHint}>
              Notifications now: {configQuery.data.notificationPolicy.suppressNow ? "Quiet hours" : "Allowed"}
            </Text>
          ) : null}
          {experimentVariants.length > 0 ? (
            <Text style={styles.runtimeHint}>
              Experiment variant: {experimentVariants[0][0]}={experimentVariants[0][1]}
            </Text>
          ) : null}
          {summary ? (
            <Text style={styles.runtimeHint}>
              Unlocked badges: {unlockedBadges.length}
            </Text>
          ) : null}
        </GlassCard>

        {env.appEnv !== "production" ? (
          <>
            <Text style={styles.sectionTitle}>QA Mode</Text>
            <GlassCard style={styles.qaCard}>
              <Text style={styles.qaTitle}>Runtime</Text>
              <Text style={styles.qaMeta}>Env: {env.appEnv}</Text>
              <Text style={styles.qaMeta}>Release: {env.releaseSha ?? "local-dev"}</Text>
              <Text style={styles.qaMeta}>User: {userId ?? "anonymous"}</Text>
              <Text style={styles.qaMeta}>City: {APP_CITY_ID}</Text>
              <Text style={styles.qaMeta}>
                Experiment:{" "}
                {experimentVariants.length > 0
                  ? `${experimentVariants[0][0]}=${experimentVariants[0][1]}`
                  : "n/a"}
              </Text>
              <Text style={styles.qaMeta}>Pending queue: {pendingCount}</Text>
              <Text style={styles.qaMeta}>
                Test location: {locationOverride ? "enabled" : "disabled"}
              </Text>

              <View style={styles.qaActionsRow}>
                <NeonButton
                  label="Force Sync"
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
                  label="Clear Queue"
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
                      ? "Disable Test Location"
                      : "Enable Test Location"
                  }
                  variant="secondary"
                  onPress={() => {
                    if (locationOverride) {
                      clearLocationOverride();
                      setQaStatus("Test location disabled");
                      return;
                    }
                    setLocationOverride({
                      lat: APP_CITY_ANCHOR.lat,
                      lng: APP_CITY_ANCHOR.lng,
                      accuracyM: 8,
                      source: "app_test_location",
                    });
                    trackUiEvent("map_use_test_location", {
                      cityId: APP_CITY_ID,
                      source: "qa_mode",
                    });
                    setQaStatus("Test location enabled");
                  }}
                />
                <NeonButton
                  label="Reset Session"
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
    paddingBottom: 120,
    gap: theme.spacing.sm,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
  },
  avatarFallback: {
    width: 64,
    height: 64,
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
    fontSize: 24,
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
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
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
  cityLabel: {
    color: theme.colors.textSecondary,
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
