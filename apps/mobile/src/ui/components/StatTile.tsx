import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";

type StatTileProps = {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
};

export function StatTile({ label, value, icon, iconColor }: StatTileProps) {
  return (
    <GlassCard style={styles.card}>
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={iconColor ?? theme.colors.accentCyan}
          style={styles.icon}
        />
      ) : null}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: 16,
    alignItems: "center",
    gap: 2,
  },
  icon: {
    marginBottom: 2,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
});
