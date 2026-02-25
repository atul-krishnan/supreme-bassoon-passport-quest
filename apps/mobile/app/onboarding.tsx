import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { trackUiEvent } from "../src/analytics/events";
import { updateMyProfile } from "../src/api/endpoints";
import { useSessionStore } from "../src/state/session";
import { theme } from "../src/theme";
import { GlassCard, InlineError, NeonButton, ScreenContainer } from "../src/ui";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const needsOnboarding = useSessionStore((state) => state.needsOnboarding);
  const setNeedsOnboarding = useSessionStore((state) => state.setNeedsOnboarding);

  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedUsername = useMemo(() => username.trim(), [username]);

  const submitMutation = useMutation({
    mutationFn: async () =>
      updateMyProfile({
        username: normalizedUsername,
      }),
    onSuccess: async () => {
      setNeedsOnboarding(false);
      trackUiEvent("onboarding_completed");
      await queryClient.invalidateQueries({ queryKey: ["user-summary"] });
      router.replace("/(tabs)");
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save username. Please try again.",
      );
    },
  });

  if (!needsOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.heroWrap}>
          <Text style={styles.title}>Stop scrolling.{"\n"}Start doing.</Text>
          <Text style={styles.subtitle}>
            Get a plan in under 2 minutes. Start by choosing your explorer name.
          </Text>
        </View>

        <GlassCard style={styles.formCard}>
          <Text style={styles.formTitle}>Set your username</Text>
          <TextInput
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              setErrorMessage(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            placeholder="e.g. atul_explorer"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            accessibilityLabel="Username"
          />

          <Text style={styles.hint}>
            Use 3-32 characters: letters, numbers, and underscore.
          </Text>

          {errorMessage ? <InlineError message={errorMessage} /> : null}
          {submitMutation.error && !errorMessage ? (
            <InlineError
              message={String((submitMutation.error as Error).message)}
            />
          ) : null}

          <NeonButton
            label="Get Started"
            loading={submitMutation.isPending}
            disabled={!USERNAME_PATTERN.test(normalizedUsername)}
            onPress={() => submitMutation.mutate()}
            style={styles.ctaButton}
          />
        </GlassCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  heroWrap: {
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    lineHeight: 24,
  },
  formCard: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  formTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(110, 148, 211, 0.40)",
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(10, 18, 34, 0.75)",
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
  },
  ctaButton: {
    marginTop: theme.spacing.xs,
  },
});
