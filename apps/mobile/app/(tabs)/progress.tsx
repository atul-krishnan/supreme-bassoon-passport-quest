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
  StatTile,
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

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Progress" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summaryQuery.isLoading ? <LoadingShimmer label="Loading progress..." /> : null}
        {summaryQuery.error ? <InlineError message="Could not load progress summary." /> : null}

        {summary ? (
          <>
            <GlassCard style={styles.levelCard}>
              <Text style={styles.levelTitle}>Level {summary.stats.level}</Text>
              <Text style={styles.levelSubtitle}>XP total: {summary.stats.xpTotal}</Text>
              <View style={{ height: theme.spacing.sm }} />
              <XPBar
                value={summary.stats.xpTotal}
                max={Math.max(100, summary.stats.level * 200)}
                label="Progress to next level"
              />
            </GlassCard>

            <View style={styles.statsRow}>
              <StatTile label="Quests" value={summary.stats.questsCompleted} />
              <StatTile label="Streak" value={summary.stats.streakDays} />
              <StatTile
                label="Saved Plans"
                value={savedPlansQuery.data?.items.length ?? 0}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Badges</Text>
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
              style={[
                styles.badgeCard,
                !badge.unlocked ? styles.badgeCardLocked : undefined,
              ]}
            >
              <Text style={styles.badgeName}>{badge.name}</Text>
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
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  levelCard: {
    borderRadius: theme.radius.xl,
  },
  levelTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  levelSubtitle: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  badgeCard: {
    width: "47%",
    minHeight: 96,
    justifyContent: "space-between",
  },
  badgeCardLocked: {
    opacity: 0.4,
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
