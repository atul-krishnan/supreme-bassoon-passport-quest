import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
            <Text style={styles.heroName}>{summary.user.username}</Text>
            <Text style={styles.heroSubtitle}>Explorer level {summary.stats.level}</Text>
            <View style={{ height: theme.spacing.sm }} />
            <XPBar
              value={summary.stats.xpTotal}
              max={Math.max(100, summary.stats.level * 200)}
              label="Journey progression"
            />
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{summary.stats.questsCompleted}</Text>
                <Text style={styles.metricLabel}>Quests</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{summary.stats.streakDays}</Text>
                <Text style={styles.metricLabel}>Streak</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{savedPlansQuery.data?.items.length ?? 0}</Text>
                <Text style={styles.metricLabel}>Saved</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <Text style={styles.sectionMeta}>{unlockedBadges.length}/{badges.length}</Text>
        </View>
        {badgesQuery.isLoading ? <LoadingShimmer label="Loading badges..." /> : null}
        {badgesQuery.error ? <InlineError message="Could not load badges right now." /> : null}
        {badgesQuery.isSuccess && badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            description="Complete plans and quests to unlock badges."
          />
        ) : null}

        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <GlassCard
              key={badge.key}
              style={[styles.badgeCard, !badge.unlocked ? styles.badgeLocked : undefined]}
            >
              <Text style={styles.badgeName} numberOfLines={2}>
                {badge.name}
              </Text>
              <Text style={styles.badgeState}>
                {badge.unlocked ? "Unlocked" : "Locked"}
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
  heroName: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },
  metricRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
  },
  metricItem: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(108, 144, 210, 0.26)",
    backgroundColor: "rgba(14, 24, 45, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
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
    fontSize: 30,
    lineHeight: 34,
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
    minHeight: 116,
    justifyContent: "space-between",
  },
  badgeLocked: {
    opacity: 0.42,
  },
  badgeName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  badgeState: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
