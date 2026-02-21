import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type BadgeChipProps = {
  label: string;
  unlocked: boolean;
};

export function BadgeChip({ label, unlocked }: BadgeChipProps) {
  return (
    <View style={[styles.base, unlocked ? styles.unlocked : styles.locked]}>
      <Text
        style={[
          styles.text,
          unlocked ? styles.unlockedText : styles.lockedText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    maxWidth: 160,
  },
  unlocked: {
    borderColor: theme.colors.accentGreen,
    backgroundColor: "#0F2A24",
  },
  locked: {
    borderColor: theme.colors.border,
    backgroundColor: "#10192F",
  },
  text: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
  },
  unlockedText: {
    color: theme.colors.accentGreen,
  },
  lockedText: {
    color: theme.colors.textMuted,
  },
});
