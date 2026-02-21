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
import { useSessionStore } from "../../src/state/session";
import { useOfflineSyncState } from "../../src/state/offlineSync";
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
  const cityId = useSessionStore((state) => state.activeCityId);
  const setCity = useSessionStore((state) => state.setCity);

  const pendingCount = useOfflineSyncState((state) => state.pendingCount);
  const isSyncing = useOfflineSyncState((state) => state.isSyncing);
  const lastSyncAt = useOfflineSyncState((state) => state.lastSyncAt);
  const lastError = useOfflineSyncState((state) => state.lastError);

  const [isEditing, setIsEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const badgesQuery = useQuery({
    queryKey: ["user-badges"],
    queryFn: () => getUserBadges(),
  });

  const configQuery = useQuery({
    queryKey: ["bootstrap-config", cityId],
    queryFn: () => getBootstrapConfig(cityId),
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

        <Text style={styles.sectionTitle}>Dev City Switch</Text>
        <GlassCard style={styles.cityCard}>
          <Text style={styles.cityLabel}>Active city: {cityId.toUpperCase()}</Text>
          <View style={styles.cityButtons}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCity("blr");
                trackUiEvent("profile_switch_city", { cityId: "blr" });
              }}
              style={[
                styles.cityButton,
                cityId === "blr" ? styles.cityButtonActive : undefined,
              ]}
            >
              <Text style={styles.cityButtonLabel}>Use BLR</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCity("nyc");
                trackUiEvent("profile_switch_city", { cityId: "nyc" });
              }}
              style={[
                styles.cityButton,
                cityId === "nyc" ? styles.cityButtonActive : undefined,
              ]}
            >
              <Text style={styles.cityButtonLabel}>Use NYC (staging)</Text>
            </Pressable>
          </View>

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
  cityButtons: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  cityButton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  cityButtonActive: {
    borderColor: theme.colors.accentGreen,
    backgroundColor: "#123A31",
  },
  cityButtonLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  runtimeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
  },
});
