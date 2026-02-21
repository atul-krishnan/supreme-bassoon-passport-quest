import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type LoadingShimmerProps = {
  label?: string;
};

export function LoadingShimmer({ label = "Loading..." }: LoadingShimmerProps) {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={theme.colors.accentCyan} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
});
