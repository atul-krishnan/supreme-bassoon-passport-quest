import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  EnergyBaseline,
  FocusPillar,
  FrictionPoint,
} from "@passport-quest/shared";
import { trackUiEvent } from "../src/analytics/events";
import { getHeroPlay, saveFlowDiagnostic } from "../src/api/endpoints";
import { useSessionStore } from "../src/state/session";
import { useFlowStateStore } from "../src/state/flowstate";
import { theme } from "../src/theme";
import { GlassCard, InlineError, NeonButton, ScreenContainer } from "../src/ui";

type Option<T extends string> = {
  value: T;
  label: string;
  detail: string;
};

const ENERGY_OPTIONS: Option<EnergyBaseline>[] = [
  {
    value: "low",
    label: "Low",
    detail: "Need a gentle launch and fewer switches.",
  },
  {
    value: "balanced",
    label: "Balanced",
    detail: "Steady rhythm with room for focused execution.",
  },
  {
    value: "high",
    label: "High",
    detail: "Ready for a high-intensity action block.",
  },
];

const FOCUS_OPTIONS: Option<FocusPillar>[] = [
  {
    value: "deep_work",
    label: "Deep Work",
    detail: "Output-first execution for high-leverage tasks.",
  },
  {
    value: "vitality_health",
    label: "Vitality / Health",
    detail: "Energy and body reset that improves delivery.",
  },
  {
    value: "local_discovery",
    label: "Local Discovery",
    detail: "Short real-world scripts with local momentum.",
  },
];

const FRICTION_OPTIONS: Option<FrictionPoint>[] = [
  {
    value: "decision_paralysis",
    label: "Decision Paralysis",
    detail: "Too many choices are blocking execution.",
  },
  {
    value: "procrastination",
    label: "Procrastination",
    detail: "You know the task, but momentum is delayed.",
  },
];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const needsOnboarding = useSessionStore((state) => state.needsOnboarding);
  const setNeedsOnboarding = useSessionStore((state) => state.setNeedsOnboarding);

  const energyBaseline = useFlowStateStore((state) => state.diagnostic.energyBaseline);
  const focusPillar = useFlowStateStore((state) => state.diagnostic.focusPillar);
  const frictionPoint = useFlowStateStore((state) => state.diagnostic.frictionPoint);
  const setEnergyBaseline = useFlowStateStore((state) => state.setEnergyBaseline);
  const setFocusPillar = useFlowStateStore((state) => state.setFocusPillar);
  const setFrictionPoint = useFlowStateStore((state) => state.setFrictionPoint);
  const applyDiagnostic = useFlowStateStore((state) => state.applyDiagnostic);
  const setHeroPlay = useFlowStateStore((state) => state.setHeroPlay);

  const [stepIndex, setStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRunDiagnostic = useMemo(
    () => Boolean(energyBaseline && focusPillar && frictionPoint),
    [energyBaseline, focusPillar, frictionPoint],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!energyBaseline || !focusPillar || !frictionPoint) {
        throw new Error("Complete all diagnostic steps first.");
      }

      const diagnostic = await saveFlowDiagnostic({
        energyBaseline,
        focusPillar,
        frictionPoint,
      });

      const hero = await getHeroPlay();
      return { diagnostic, hero };
    },
    onSuccess: async ({ diagnostic, hero }) => {
      applyDiagnostic(diagnostic);
      if (hero.heroPlay) {
        setHeroPlay(hero.heroPlay);
      }
      trackUiEvent("flow_diagnostic_completed", {
        energyBaseline: diagnostic.energyBaseline,
        focusPillar: diagnostic.focusPillar,
        frictionPoint: diagnostic.frictionPoint,
      });
      setStepIndex(3);
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["user-summary"] });
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not complete diagnostic. Please retry.",
      );
    },
  });

  if (!needsOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  const renderEnergyStep = () => (
    <>
      <Text style={styles.title}>Life Diagnostic</Text>
      <Text style={styles.subtitle}>Set your current baseline. We handle the decisions.</Text>
      <GlassCard style={styles.card}>
        <Text style={styles.stepLabel}>1 of 3 · Energy Baseline</Text>
        {ENERGY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => {
              setEnergyBaseline(option.value);
              setErrorMessage(null);
              setStepIndex(1);
            }}
            style={[
              styles.option,
              energyBaseline === option.value ? styles.optionActive : undefined,
            ]}
          >
            <Text style={styles.optionTitle}>{option.label}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </Pressable>
        ))}
      </GlassCard>
    </>
  );

  const renderFocusStep = () => (
    <>
      <Text style={styles.title}>Life Diagnostic</Text>
      <Text style={styles.subtitle}>What should this assistant optimize first?</Text>
      <GlassCard style={styles.card}>
        <Text style={styles.stepLabel}>2 of 3 · Focus Pillar</Text>
        {FOCUS_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => {
              setFocusPillar(option.value);
              setErrorMessage(null);
              setStepIndex(2);
            }}
            style={[
              styles.option,
              focusPillar === option.value ? styles.optionActive : undefined,
            ]}
          >
            <Text style={styles.optionTitle}>{option.label}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </Pressable>
        ))}
      </GlassCard>
      <NeonButton
        label="Back"
        variant="secondary"
        onPress={() => setStepIndex(0)}
      />
    </>
  );

  const renderFrictionStep = () => (
    <>
      <Text style={styles.title}>Life Diagnostic</Text>
      <Text style={styles.subtitle}>Identify the blocker. We’ll script the next move.</Text>
      <GlassCard style={styles.card}>
        <Text style={styles.stepLabel}>3 of 3 · Friction Point</Text>
        {FRICTION_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => {
              setFrictionPoint(option.value);
              setErrorMessage(null);
            }}
            style={[
              styles.option,
              frictionPoint === option.value ? styles.optionActive : undefined,
            ]}
          >
            <Text style={styles.optionTitle}>{option.label}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </Pressable>
        ))}
      </GlassCard>
      {errorMessage ? <InlineError message={errorMessage} /> : null}
      <NeonButton
        label="Run Diagnostic"
        loading={submitMutation.isPending}
        disabled={!canRunDiagnostic}
        onPress={() => submitMutation.mutate()}
      />
      <NeonButton
        label="Back"
        variant="secondary"
        onPress={() => setStepIndex(1)}
      />
    </>
  );

  const renderDoneStep = () => (
    <>
      <Text style={styles.title}>Diagnostic Complete.</Text>
      <Text style={styles.subtitle}>Decisions handled. Your first Play is ready.</Text>
      <GlassCard style={styles.doneCard}>
        <Text style={styles.doneText}>
          Stop planning. Start doing.
        </Text>
      </GlassCard>
      <NeonButton
        label="Enter FlowState"
        onPress={() => {
          setNeedsOnboarding(false);
          trackUiEvent("onboarding_completed");
          router.replace("/(tabs)");
        }}
      />
    </>
  );

  return (
    <ScreenContainer>
      <View style={styles.root}>
        {stepIndex === 0 ? renderEnergyStep() : null}
        {stepIndex === 1 ? renderFocusStep() : null}
        {stepIndex === 2 ? renderFrictionStep() : null}
        {stepIndex === 3 ? renderDoneStep() : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.display.fontSize,
    lineHeight: theme.typography.display.lineHeight,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontFamily: theme.typography.body.fontFamily,
  },
  card: {
    gap: theme.spacing.sm,
  },
  stepLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "600",
    fontFamily: theme.typography.caption.fontFamily,
  },
  option: {
    borderWidth: 1,
    borderColor: "rgba(125, 159, 220, 0.34)",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: "rgba(7, 15, 32, 0.7)",
    gap: 4,
  },
  optionActive: {
    borderColor: "rgba(58, 215, 255, 0.78)",
    backgroundColor: "rgba(24, 56, 86, 0.56)",
    ...theme.elevation.glowCyan,
  },
  optionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.body.fontFamily,
  },
  optionDetail: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontFamily: theme.typography.caption.fontFamily,
  },
  doneCard: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
  },
  doneText: {
    color: theme.colors.accentGreen,
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.title.fontFamily,
    textAlign: "center",
  },
});
