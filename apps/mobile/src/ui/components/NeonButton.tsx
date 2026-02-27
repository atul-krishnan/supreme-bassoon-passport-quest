import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { theme } from "../../theme";

type NeonButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
};

export function NeonButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
}: NeonButtonProps) {
  const inactive = disabled || loading;
  const primary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        inactive ? styles.disabled : undefined,
        pressed && !inactive ? styles.pressed : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={theme.colors.textPrimary}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          primary ? styles.primaryLabel : styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: theme.radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: "rgba(125, 86, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(147, 228, 255, 0.65)",
    ...theme.elevation.glowPurple,
  },
  secondary: {
    backgroundColor: "rgba(19, 35, 70, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(108, 136, 196, 0.62)",
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: "700",
    fontFamily: theme.typography.body.fontFamily,
  },
  primaryLabel: {
    color: theme.colors.textPrimary,
  },
  secondaryLabel: {
    color: theme.colors.textPrimary,
  },
});
