import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(16, 28, 58, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(121, 153, 212, 0.42)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.elevation.card,
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    backgroundColor: "rgba(236, 244, 255, 0.08)",
  },
});
