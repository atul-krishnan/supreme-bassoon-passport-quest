import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
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
      <View
        pointerEvents="none"
        style={[
          styles.shine,
          primary ? styles.primaryShine : styles.secondaryShine,
        ]}
      />
      {loading ? (
        <ActivityIndicator
          color={primary ? "#031819" : theme.colors.textPrimary}
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
    overflow: "hidden",
  },
  primary: {
    backgroundColor: "#1E9D9F",
    borderWidth: 1,
    borderColor: "rgba(101, 240, 216, 0.55)",
    ...theme.elevation.glowGreen,
  },
  secondary: {
    backgroundColor: "rgba(30, 47, 82, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(116, 146, 206, 0.35)",
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
  },
  primaryShine: {
    backgroundColor: "rgba(146, 255, 235, 0.22)",
  },
  secondaryShine: {
    backgroundColor: "rgba(119, 155, 236, 0.16)",
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
    color: "#ECFFFB",
  },
  secondaryLabel: {
    color: theme.colors.textPrimary,
  },
});
