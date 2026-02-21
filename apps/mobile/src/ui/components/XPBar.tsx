import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type XPBarProps = {
  value: number;
  max: number;
  label?: string;
};

export function XPBar({ value, max, label }: XPBarProps) {
  const safeMax = Math.max(1, max);
  const progress = Math.min(1, Math.max(0, value / safeMax));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label ?? "XP Progress"}</Text>
        <Text style={styles.value}>
          {Math.round(value)}/{Math.round(safeMax)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "600",
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#1B2748",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.accentCyan,
    ...theme.elevation.glowCyan,
  },
});
