import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { FocusPillar } from "@passport-quest/shared";
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

function formatFocusPillar(pillar: FocusPillar) {
  if (pillar === "deep_work") {
    return "Focus";
  }
  if (pillar === "vitality_health") {
    return "Vitality";
  }
  return "Momentum";
}

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
          <Text style={styles.title}>Instant Play.</Text>
          <Text style={styles.titleAccent}>One move. Right now.</Text>
          <Text style={styles.subtitle}>
            Stop planning. Start doing. We pick one high-trust script so you can execute.
          </Text>
        </View>

        <GlassCard style={styles.heroCard}>
          {loading ? <LoadingShimmer label="Preparing your first play..." /> : null}

          {!loading && resolvedHeroPlay ? (
            <>
              <Text style={styles.eyebrow}>Decision-First Intelligence</Text>
              <Text style={styles.playTitle}>{resolvedHeroPlay.title}</Text>
              <Text style={styles.playSummary}>{resolvedHeroPlay.summary}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>⚡ {resolvedHeroPlay.durationMin} Min</Text>
                <Text style={styles.metaChip}>
                  🧠 {formatFocusPillar(resolvedHeroPlay.focusPillar)}
                </Text>
                <Text style={styles.metaChip}>🏆 +{resolvedHeroPlay.xpReward} XP</Text>
              </View>

              <View style={styles.whyChip}>
                <Text style={styles.whyText}>✨ {resolvedHeroPlay.why}</Text>
              </View>

              <Text style={styles.savingsText}>
                {resolvedHeroPlay.decisionMinutesSaved} decision minutes saved
              </Text>

              <NeonButton
                label="Start Play"
                loading={startMutation.isPending}
                onPress={() => {
                  setErrorMessage(null);
                  startMutation.mutate();
                }}
                style={styles.primaryCta}
              />
            </>
          ) : null}

          {!loading && !resolvedHeroPlay ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No play is ready yet. Complete your Energy Audit to unlock it.
              </Text>
              <NeonButton
                label="Run Energy Audit"
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
    gap: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  titleAccent: {
    color: theme.colors.accentPurple,
    fontSize: 34,
    lineHeight: 38,
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
    justifyContent: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
  },
  eyebrow: {
    color: "rgba(210, 225, 255, 0.84)",
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: theme.typography.caption.fontFamily,
  },
  playTitle: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    lineHeight: 36,
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
    gap: 6,
  },
  metaChip: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
    borderWidth: 1,
    borderColor: "rgba(109, 147, 212, 0.46)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(14, 28, 58, 0.84)",
    overflow: "hidden",
  },
  whyChip: {
    borderWidth: 1,
    borderColor: "rgba(79, 234, 255, 0.56)",
    backgroundColor: "rgba(12, 56, 87, 0.5)",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  whyText: {
    color: "#DFF8FF",
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.body.fontFamily,
  },
  savingsText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
  },
  primaryCta: {
    marginTop: theme.spacing.sm,
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
