import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getFlowStateSummary } from "../../src/api/endpoints";
import { useFlowStateStore } from "../../src/state/flowstate";
import { theme } from "../../src/theme";
import {
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  ScreenContainer,
  StatTile,
  TopBar,
  XPBar,
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
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <TopBar title="Achievement Loop" />
      </View>

      <View style={styles.content}>
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
              <Text style={styles.cardEyebrow}>Your Doing Score</Text>
              <XPBar
                value={stats.xpTotal}
                max={Math.max(120, stats.level * 220)}
                label={`Level ${stats.level} Operator`}
              />
              <Text style={styles.cardHint}>
                Decisions saved and plays completed are compounding every run.
              </Text>
            </GlassCard>

            <View style={styles.statsRow}>
              <StatTile label="Decisions Saved" value={stats.decisionsSaved} />
              <StatTile label="Plays Completed" value={stats.playsCompleted} />
            </View>
            <View style={styles.statsRowSingle}>
              <StatTile
                label="Mental Hours Saved"
                value={formatMentalHours(stats.planningMinutesSaved)}
              />
            </View>

            {activeSession ? (
              <GlassCard style={styles.resumeCard}>
                <Text style={styles.resumeTitle}>Active Play Detected</Text>
                <Text style={styles.resumeText}>
                  {activeSession.title}
                </Text>
                <NeonButton
                  label="Resume Play"
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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  mainCard: {
    gap: theme.spacing.sm,
  },
  cardEyebrow: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
  },
  cardHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  statsRowSingle: {
    flexDirection: "row",
  },
  resumeCard: {
    gap: theme.spacing.sm,
  },
  resumeTitle: {
    color: theme.colors.accentCyan,
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
