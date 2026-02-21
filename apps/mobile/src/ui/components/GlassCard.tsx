import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.elevation.card,
  },
});
