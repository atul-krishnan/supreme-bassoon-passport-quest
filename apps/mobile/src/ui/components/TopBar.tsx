import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type TopBarProps = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function TopBar({ title, subtitle, left, right }: TopBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: theme.spacing.sm,
  },
  side: {
    width: 56,
    minHeight: 36,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    alignItems: "flex-end",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: "500",
  },
});
