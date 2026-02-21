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
          color={primary ? "#03231A" : theme.colors.textPrimary}
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
    minHeight: 48,
    borderRadius: theme.radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.accentGreen,
    ...theme.elevation.glowGreen,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  },
  primaryLabel: {
    color: "#03231A",
  },
  secondaryLabel: {
    color: theme.colors.textPrimary,
  },
});
