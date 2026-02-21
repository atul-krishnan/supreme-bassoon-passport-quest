import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { trackUiEvent } from "../src/analytics/events";
import { updateMyProfile } from "../src/api/endpoints";
import { useSessionStore } from "../src/state/session";
import { theme } from "../src/theme";
import { InlineError, NeonButton, ScreenContainer } from "../src/ui";

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
        <Text style={styles.title}>Pick your explorer name</Text>
        <Text style={styles.subtitle}>
          This is how friends will find you for quests, feed updates, and
          profile compare.
        </Text>

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
          label="Start Questing"
          loading={submitMutation.isPending}
          disabled={!USERNAME_PATTERN.test(normalizedUsername)}
          onPress={() => submitMutation.mutate()}
        />
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
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
  },
});
