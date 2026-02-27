import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { trackUiEvent } from "../../src/analytics/events";
import { getHeroPlay, startPlaySession } from "../../src/api/endpoints";
import { useFlowStateStore } from "../../src/state/flowstate";
import { theme } from "../../src/theme";
import {
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  ScreenContainer,
} from "../../src/ui";

export default function HomePlayScreen() {
  const heroPlay = useFlowStateStore((state) => state.heroPlay);
  const setHeroPlay = useFlowStateStore((state) => state.setHeroPlay);
  const setExecutionSession = useFlowStateStore((state) => state.setExecutionSession);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const heroQuery = useQuery({
    queryKey: ["flow-hero-play"],
    queryFn: () => getHeroPlay(),
  });

  useEffect(() => {
    if (heroQuery.data?.status !== "ready" || !heroQuery.data.heroPlay) {
      return;
    }
    setHeroPlay(heroQuery.data.heroPlay);
    trackUiEvent("flow_hero_play_ready", {
      playId: heroQuery.data.heroPlay.playId,
      focusPillar: heroQuery.data.heroPlay.focusPillar,
    });
  }, [heroQuery.data, setHeroPlay]);

  const resolvedHeroPlay = useMemo(() => {
    if (heroQuery.data?.status === "ready" && heroQuery.data.heroPlay) {
      return heroQuery.data.heroPlay;
    }
    return heroPlay;
  }, [heroPlay, heroQuery.data]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedHeroPlay?.recommendationId) {
        throw new Error("No ready play found.");
      }

      return startPlaySession({
        recommendationId: resolvedHeroPlay.recommendationId,
      });
    },
    onSuccess: (result) => {
      if (!result.session) {
        setErrorMessage("Could not start the play session.");
        return;
      }

      setExecutionSession(result.session);
      trackUiEvent("flow_play_started", {
        sessionId: result.session.sessionId,
        playId: result.session.playId,
      });
      router.push({
        pathname: "/play/[id]",
        params: { id: result.session.sessionId },
      });
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start play.",
      );
    },
  });

  const loading = heroQuery.isLoading && !resolvedHeroPlay;

  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Stop planning.</Text>
          <Text style={styles.titleAccent}>Start doing.</Text>
          <Text style={styles.subtitle}>
            FlowState picks one execution script and removes decision drag.
          </Text>
        </View>

        <GlassCard style={styles.heroCard}>
          {loading ? <LoadingShimmer label="Preparing your first play..." /> : null}

          {!loading && resolvedHeroPlay ? (
            <>
              <Text style={styles.eyebrow}>Instant Play</Text>
              <Text style={styles.playTitle}>{resolvedHeroPlay.title}</Text>
              <Text style={styles.playSummary}>{resolvedHeroPlay.summary}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>⏱ {resolvedHeroPlay.durationMin}m</Text>
                <Text style={styles.metaChip}>⭐ +{resolvedHeroPlay.xpReward} XP</Text>
                <Text style={styles.metaChip}>
                  🧠 {resolvedHeroPlay.decisionMinutesSaved} min saved
                </Text>
              </View>

              <View style={styles.whyChip}>
                <Text style={styles.whyText}>✨ {resolvedHeroPlay.why}</Text>
              </View>

              <View style={styles.stepsBlock}>
                {resolvedHeroPlay.steps.slice(0, 3).map((step) => (
                  <View key={step.order} style={styles.stepRow}>
                    <Text style={styles.stepIndex}>{step.order}.</Text>
                    <Text style={styles.stepText}>{step.title}</Text>
                    <Text style={styles.stepDuration}>{Math.round(step.durationSec / 60)}m</Text>
                  </View>
                ))}
              </View>

              <NeonButton
                label="Start Play 🚀"
                loading={startMutation.isPending}
                onPress={() => {
                  setErrorMessage(null);
                  startMutation.mutate();
                }}
                style={styles.primaryCta}
              />

              <NeonButton
                label="Refresh Play"
                variant="secondary"
                onPress={() => {
                  setErrorMessage(null);
                  void heroQuery.refetch();
                }}
              />
            </>
          ) : null}

          {!loading && !resolvedHeroPlay ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No play is ready yet. Complete diagnostic to continue.</Text>
              <NeonButton
                label="Go to Diagnostic"
                onPress={() => router.push("/onboarding")}
              />
            </View>
          ) : null}
        </GlassCard>

        {heroQuery.error ? (
          <InlineError
            message={
              heroQuery.error instanceof Error
                ? heroQuery.error.message
                : "Could not load hero play"
            }
          />
        ) : null}
        {errorMessage ? <InlineError message={errorMessage} /> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  header: {
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  titleAccent: {
    color: theme.colors.accentGreen,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
  heroCard: {
    flex: 1,
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: theme.typography.caption.fontFamily,
  },
  playTitle: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  playSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  metaChip: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
    borderWidth: 1,
    borderColor: "rgba(116, 149, 206, 0.36)",
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(16, 30, 55, 0.72)",
  },
  whyChip: {
    borderWidth: 1,
    borderColor: "rgba(112, 255, 223, 0.4)",
    backgroundColor: "rgba(34, 93, 78, 0.42)",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  whyText: {
    color: "#D9FFF3",
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.body.fontFamily,
  },
  stepsBlock: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  stepIndex: {
    color: theme.colors.accentCyan,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "700",
    width: 20,
    fontFamily: theme.typography.body.fontFamily,
  },
  stepText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.body.fontFamily,
  },
  stepDuration: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  primaryCta: {
    marginTop: theme.spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
});
