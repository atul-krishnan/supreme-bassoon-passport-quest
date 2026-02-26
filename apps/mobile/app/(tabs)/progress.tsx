import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getSavedPlans, getUserBadges, getUserSummary } from "../../src/api/endpoints";
import { theme } from "../../src/theme";
import {
  EmptyState,
  GlassCard,
  InlineError,
  LoadingShimmer,
  ScreenContainer,
  TopBar,
  XPBar,
} from "../../src/ui";

export default function ProgressScreen() {
  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const badgesQuery = useQuery({
    queryKey: ["user-badges"],
    queryFn: () => getUserBadges(),
  });

  const savedPlansQuery = useQuery({
    queryKey: ["saved-plans-count"],
    queryFn: () => getSavedPlans(50),
  });

  const summary = summaryQuery.data;
  const badges = badgesQuery.data?.badges ?? [];
  const unlockedBadges = badges.filter((badge) => badge.unlocked);

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Progress" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {summaryQuery.isLoading ? <LoadingShimmer label="Loading progress..." /> : null}
        {summaryQuery.error ? <InlineError message="Could not load progress summary." /> : null}

        {summary ? (
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroHead}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {summary.user.username.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{summary.user.username}</Text>
                <Text style={styles.heroSubtitle}>🏅 Explorer level {summary.stats.level}</Text>
              </View>
            </View>
            <View style={{ height: theme.spacing.sm }} />
            <XPBar
              value={summary.stats.xpTotal}
              max={Math.max(100, summary.stats.level * 200)}
              label="Journey progression"
            />
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricEmoji}>🎯</Text>
                <Text style={styles.metricValue}>{summary.stats.questsCompleted}</Text>
                <Text style={styles.metricLabel}>Quests</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricEmoji}>🔥</Text>
                <Text style={styles.metricValue}>{summary.stats.streakDays}</Text>
                <Text style={styles.metricLabel}>Streak</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricEmoji}>💾</Text>
                <Text style={styles.metricValue}>{savedPlansQuery.data?.items.length ?? 0}</Text>
                <Text style={styles.metricLabel}>Saved</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>🏆 Badges</Text>
          <Text style={styles.sectionMeta}>{unlockedBadges.length}/{badges.length}</Text>
        </View>
        {badgesQuery.isLoading ? <LoadingShimmer label="Loading badges..." /> : null}
        {badgesQuery.error ? <InlineError message="Could not load badges right now." /> : null}
        {badgesQuery.isSuccess && badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            description="Complete plans and quests to unlock badges."
            icon="ribbon-outline"
          />
        ) : null}

        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <GlassCard
              key={badge.key}
              style={[styles.badgeCard, !badge.unlocked ? styles.badgeLocked : undefined]}
            >
              <View style={styles.badgeIconWrap}>
                <Ionicons
                  name={badge.unlocked ? "trophy" : "lock-closed"}
                  size={28}
                  color={badge.unlocked ? theme.colors.accentGreen : theme.colors.textMuted}
                />
              </View>
              <Text style={styles.badgeName} numberOfLines={2}>
                {badge.name}
              </Text>
              <Text style={[styles.badgeState, badge.unlocked ? styles.badgeUnlockedState : undefined]}>
                {badge.unlocked ? "✅ Unlocked" : "🔒 Locked"}
              </Text>
            </GlassCard>
          ))}
        </View>
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
  heroCard: {
    borderRadius: 20,
    gap: theme.spacing.xs,
  },
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#213565",
    borderWidth: 2,
    borderColor: theme.colors.accentCyan,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.accentCyan,
    fontSize: 22,
    fontWeight: "800",
  },
  heroName: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  metricRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
  },
  metricItem: {
    flex: 1,
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(108, 144, 210, 0.26)",
    backgroundColor: "rgba(14, 24, 45, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: theme.spacing.xs,
  },
  metricEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  badgeCard: {
    width: "47%",
    minHeight: 130,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(30, 50, 90, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  badgeName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  badgeState: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  badgeUnlockedState: {
    color: theme.colors.accentGreen,
  },
});
