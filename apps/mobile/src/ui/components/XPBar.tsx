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
        <Text style={styles.label}>⭐ {label ?? "XP Progress"}</Text>
        <Text style={styles.value}>
          {Math.round(value)}/{Math.round(safeMax)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]}>
          <View style={styles.shimmer} />
        </View>
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
    backgroundColor: "rgba(32, 48, 87, 0.82)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(106, 139, 199, 0.28)",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#29D6C7",
    ...theme.elevation.glowCyan,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
  },
});
