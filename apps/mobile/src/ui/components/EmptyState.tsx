import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon ? (
        <View style={styles.iconWrap}>
          <View style={styles.iconGlow} />
          <Ionicons name={icon} size={48} color={theme.colors.textMuted} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "rgba(58, 215, 255, 0.08)",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    textAlign: "center",
    lineHeight: theme.typography.body.lineHeight,
    paddingHorizontal: theme.spacing.md,
  },
});
