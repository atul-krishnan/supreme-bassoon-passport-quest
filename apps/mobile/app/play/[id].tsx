import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { trackUiEvent } from "../../src/analytics/events";
import { getPlaySession, markPlayStepDone } from "../../src/api/endpoints";
import { useFlowStateStore } from "../../src/state/flowstate";
import { theme } from "../../src/theme";
import { GlassCard, InlineError, NeonButton, ScreenContainer } from "../../src/ui";

type Params = {
  id?: string;
};

function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function computeRemainingSec(durationSec: number, startedAt?: string) {
  if (!startedAt) {
    return durationSec;
  }
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) {
    return durationSec;
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
  return Math.max(0, durationSec - elapsed);
}

export default function PlayExecutionScreen() {
  const { id } = useLocalSearchParams<Params>();
  const queryClient = useQueryClient();

  const execution = useFlowStateStore((state) => state.execution);
  const setExecutionSession = useFlowStateStore((state) => state.setExecutionSession);
  const setRemainingSec = useFlowStateStore((state) => state.setRemainingSec);
  const setTimerRunning = useFlowStateStore((state) => state.setTimerRunning);
  const applyStepResult = useFlowStateStore((state) => state.applyStepResult);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionId = typeof id === "string" ? id : "";

  const sessionQuery = useQuery({
    queryKey: ["flow-play-session", sessionId],
    enabled: sessionId.length > 0,
    queryFn: () => getPlaySession(sessionId),
  });

  useEffect(() => {
    if (sessionQuery.data?.session) {
      setExecutionSession(sessionQuery.data.session);
    }
  }, [sessionQuery.data?.session, setExecutionSession]);

  const session = useMemo(() => {
    if (sessionQuery.data?.session) {
      return sessionQuery.data.session;
    }
    if (execution.session?.sessionId === sessionId) {
      return execution.session;
    }
    return null;
  }, [execution.session, sessionId, sessionQuery.data?.session]);

  const currentStep = useMemo(() => {
    if (!session) {
      return null;
    }

    const activeStep = session.steps.find((step) => step.status === "active");
    if (activeStep) {
      return activeStep;
    }

    if (session.currentStepOrder !== null) {
      return (
        session.steps.find((step) => step.order === session.currentStepOrder) ?? null
      );
    }

    return null;
  }, [session]);

  useEffect(() => {
    if (!currentStep || !session) {
      setRemainingSec(0);
      setTimerRunning(false);
      return;
    }

    setRemainingSec(computeRemainingSec(currentStep.durationSec, currentStep.startedAt));
    setTimerRunning(session.status === "in_progress");
  }, [currentStep, session, setRemainingSec, setTimerRunning]);

  useEffect(() => {
    if (!session || !currentStep) {
      return;
    }
    if (!execution.timerRunning || session.status !== "in_progress") {
      return;
    }

    const interval = setInterval(() => {
      setRemainingSec(execution.remainingSec - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [
    currentStep,
    execution.remainingSec,
    execution.timerRunning,
    session,
    setRemainingSec,
  ]);

  const stepDoneMutation = useMutation({
    mutationFn: async () => {
      if (!session || !currentStep) {
        throw new Error("No active step found.");
      }
      return markPlayStepDone(session.sessionId, currentStep.order);
    },
    onSuccess: async (result) => {
      applyStepResult(result);
      setErrorMessage(null);

      if (result.status === "completed") {
        trackUiEvent("flow_play_completed", {
          sessionId: session?.sessionId,
          playId: session?.playId,
          xpAwarded: result.reward?.xpAwarded ?? 0,
        });
      } else {
        trackUiEvent("flow_play_step_done", {
          sessionId: session?.sessionId,
          stepOrder: currentStep?.order ?? null,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flow-play-session", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["flowstate-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["user-summary"] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not mark step done.",
      );
    },
  });

  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <Text style={styles.modeLabel}>Execution Script</Text>
          <View style={styles.backButton} />
        </View>

        {sessionQuery.isLoading ? (
          <GlassCard>
            <Text style={styles.secondaryText}>Loading play session...</Text>
          </GlassCard>
        ) : null}

        {session ? (
          <GlassCard style={styles.heroCard}>
            <Text style={styles.title}>{session.title}</Text>
            <Text style={styles.secondaryText}>{session.why}</Text>

            <View style={styles.timerWrap}>
              <Text style={styles.timerLabel}>Current Step Timer</Text>
              <Text style={styles.timerValue}>{formatCountdown(execution.remainingSec)}</Text>
            </View>

            <View style={styles.stepsList}>
              {session.steps.map((step) => {
                const isActive = step.status === "active";
                const isCompleted = step.status === "completed";
                return (
                  <View
                    key={step.order}
                    style={[
                      styles.stepCard,
                      isActive ? styles.stepCardActive : undefined,
                      isCompleted ? styles.stepCardDone : undefined,
                    ]}
                  >
                    <Text style={styles.stepTitle}>
                      {step.order}. {step.title}
                    </Text>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepMeta}>
                      {Math.round(step.durationSec / 60)} min · {isCompleted ? "Done" : isActive ? "Active" : "Pending"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        ) : null}

        {session?.status === "completed" ? (
          <GlassCard style={styles.completionCard}>
            <Text style={styles.completionTitle}>Play Completed</Text>
            <Text style={styles.secondaryText}>XP credited. Decisions saved. Momentum locked.</Text>
            <NeonButton
              label="View Results"
              onPress={() => router.replace("/(tabs)/profile")}
            />
          </GlassCard>
        ) : (
          <View style={styles.actions}>
            <NeonButton
              label="Mark Done"
              loading={stepDoneMutation.isPending}
              disabled={!session || !currentStep}
              onPress={() => {
                setErrorMessage(null);
                stepDoneMutation.mutate();
              }}
            />
            <NeonButton
              label={execution.timerRunning ? "Pause Timer" : "Resume Timer"}
              variant="secondary"
              onPress={() => setTimerRunning(!execution.timerRunning)}
              disabled={!session}
            />
          </View>
        )}

        {sessionQuery.error ? (
          <InlineError
            message={
              sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : "Could not load play session"
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
    gap: theme.spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    minWidth: 56,
  },
  backLabel: {
    color: theme.colors.accentCyan,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.body.fontFamily,
  },
  modeLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroCard: {
    gap: theme.spacing.sm,
    flex: 1,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  secondaryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
  timerWrap: {
    borderWidth: 1,
    borderColor: "rgba(107, 252, 217, 0.45)",
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    backgroundColor: "rgba(15, 55, 50, 0.4)",
    alignItems: "center",
    ...theme.elevation.glowGreen,
  },
  timerLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  timerValue: {
    color: theme.colors.textPrimary,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  stepsList: {
    gap: theme.spacing.xs,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: "rgba(120, 151, 213, 0.35)",
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    backgroundColor: "rgba(10, 20, 39, 0.72)",
    gap: 4,
  },
  stepCardActive: {
    borderColor: "rgba(58, 215, 255, 0.75)",
    backgroundColor: "rgba(22, 62, 89, 0.6)",
    ...theme.elevation.glowCyan,
  },
  stepCardDone: {
    borderColor: "rgba(62, 236, 169, 0.6)",
    backgroundColor: "rgba(20, 70, 48, 0.5)",
  },
  stepTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.body.fontFamily,
  },
  stepInstruction: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  stepMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  completionCard: {
    gap: theme.spacing.sm,
  },
  completionTitle: {
    color: theme.colors.accentGreen,
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.title.fontFamily,
  },
  actions: {
    gap: theme.spacing.xs,
  },
});
