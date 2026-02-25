import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type ReasonListProps = {
  reasons: string[];
  title?: string;
  maxItems?: number;
  style?: ViewStyle;
};

export function ReasonList({
  reasons,
  title = "Why this is recommended",
  maxItems = 4,
  style,
}: ReasonListProps) {
  const items = reasons.filter((item) => item.trim().length > 0).slice(0, maxItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={style}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {items.map((reason) => (
          <View key={reason} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.reason}>{reason}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  list: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
  },
  bullet: {
    color: theme.colors.accentGreen,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  reason: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
