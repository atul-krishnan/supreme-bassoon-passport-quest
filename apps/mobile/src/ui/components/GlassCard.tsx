import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(12, 20, 40, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(109, 146, 210, 0.26)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.elevation.card,
  },
});
