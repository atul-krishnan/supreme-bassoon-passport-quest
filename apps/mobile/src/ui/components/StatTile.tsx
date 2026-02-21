import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";

type StatTileProps = {
  label: string;
  value: string | number;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});
