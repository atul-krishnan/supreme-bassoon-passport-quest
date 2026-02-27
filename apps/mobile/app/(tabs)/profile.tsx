import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getFlowStateSummary } from "../../src/api/endpoints";
import { useFlowStateStore } from "../../src/state/flowstate";
import { theme } from "../../src/theme";
import {
  CircularProgress,
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  ScreenContainer,
  StatTile,
} from "../../src/ui";

function formatMentalHours(minutes: number) {
  const hours = Math.max(0, minutes) / 60;
  if (hours >= 10) {
    return Math.round(hours);
  }
  return Number(hours.toFixed(1));
}

export default function ProfileScreen() {
  const syncMetrics = useFlowStateStore((state) => state.syncMetrics);

  const summaryQuery = useQuery({
    queryKey: ["flowstate-summary"],
    queryFn: () => getFlowStateSummary(),
  });

  useEffect(() => {
    if (!summaryQuery.data) {
      return;
    }
    syncMetrics({
      xpTotal: summaryQuery.data.stats.xpTotal,
      level: summaryQuery.data.stats.level,
      playsCompleted: summaryQuery.data.stats.playsCompleted,
      decisionsSaved: summaryQuery.data.stats.decisionsSaved,
      planningMinutesSaved: summaryQuery.data.stats.planningMinutesSaved,
    });
  }, [summaryQuery.data, syncMetrics]);

  const stats = summaryQuery.data?.stats;
  const activeSession = summaryQuery.data?.activeSession;

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Habit Forge</Text>
          <Text style={styles.title}>Rewards for Action</Text>
          <Text style={styles.subtitle}>
            Decisions saved, not tasks planned.
          </Text>
        </View>

        {summaryQuery.isLoading ? <LoadingShimmer label="Loading execution metrics..." /> : null}
        {summaryQuery.error ? (
          <InlineError
            message={
              summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Could not load FlowState summary"
            }
          />
        ) : null}

        {stats ? (
          <>
            <GlassCard style={styles.mainCard}>
              <CircularProgress
                value={stats.xpTotal}
                max={Math.max(140, stats.level * 220)}
                label={`Level ${stats.level}`}
                subtitle={`${stats.playsCompleted} plays complete`}
              />
              <Text style={styles.cardHint}>
                The ring fills as execution compounds.
              </Text>
            </GlassCard>

            <View style={styles.statsRow}>
              <StatTile label="Decisions Saved 😎" value={stats.decisionsSaved} />
              <StatTile label="Plays Completed" value={stats.playsCompleted} />
            </View>
            <View style={styles.statsRow}>
              <StatTile
                label="Mental Hours Saved"
                value={formatMentalHours(stats.planningMinutesSaved)}
              />
              <StatTile
                label="Minutes Removed"
                value={stats.planningMinutesSaved}
              />
            </View>

            {activeSession ? (
              <GlassCard style={styles.resumeCard}>
                <Text style={styles.resumeTitle}>Execution in Progress</Text>
                <Text style={styles.resumeText}>
                  {activeSession.title}
                </Text>
                <NeonButton
                  label="Resume Script"
                  onPress={() =>
                    router.push({
                      pathname: "/play/[id]",
                      params: { id: activeSession.sessionId },
                    })
                  }
                />
              </GlassCard>
            ) : null}
          </>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: theme.spacing.md,
  },
  header: {
    gap: 3,
  },
  eyebrow: {
    color: "rgba(207, 224, 255, 0.85)",
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: theme.typography.caption.fontFamily,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
  mainCard: {
    gap: theme.spacing.md,
    alignItems: "center",
  },
  cardHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    textAlign: "center",
    fontFamily: theme.typography.caption.fontFamily,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  resumeCard: {
    gap: theme.spacing.sm,
  },
  resumeTitle: {
    color: theme.colors.accentPurple,
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.title.fontFamily,
  },
  resumeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
});
