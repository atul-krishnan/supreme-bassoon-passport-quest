import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.root}>
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
  },
});
