import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type BadgeCabinetChipProps = {
  label: string;
  unlocked: boolean;
  variant?: "badge";
};

type ScenarioChipProps = {
  label: string;
  emoji: string;
  variant: "scenario";
  active?: boolean;
  onPress?: () => void;
};

type BadgeChipProps = BadgeCabinetChipProps | ScenarioChipProps;

function isScenarioChip(props: BadgeChipProps): props is ScenarioChipProps {
  return props.variant === "scenario";
}

export function BadgeChip(props: BadgeChipProps) {
  if (isScenarioChip(props)) {
    const content = (
      <>
        <Text style={styles.scenarioEmoji}>{props.emoji}</Text>
        <Text
          style={[
            styles.scenarioText,
            props.active ? styles.scenarioTextActive : styles.scenarioTextIdle,
          ]}
          numberOfLines={1}
        >
          {props.label}
        </Text>
      </>
    );

    if (props.onPress) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={props.onPress}
          style={({ pressed }) => [
            styles.scenarioBase,
            props.active ? styles.scenarioActive : styles.scenarioIdle,
            pressed ? styles.scenarioPressed : undefined,
          ]}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View
        style={[
          styles.scenarioBase,
          props.active ? styles.scenarioActive : styles.scenarioIdle,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badgeBase,
        props.unlocked ? styles.unlocked : styles.locked,
      ]}
    >
      <Text style={styles.emoji}>{props.unlocked ? "🏆" : "🔒"}</Text>
      <Text
        style={[
          styles.text,
          props.unlocked ? styles.unlockedText : styles.lockedText,
        ]}
        numberOfLines={1}
      >
        {props.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unlocked: {
    borderColor: theme.colors.accentGreen,
    backgroundColor: "#0F2A24",
  },
  locked: {
    borderColor: theme.colors.border,
    backgroundColor: "#10192F",
  },
  emoji: {
    fontSize: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  unlockedText: {
    color: theme.colors.accentGreen,
  },
  lockedText: {
    color: theme.colors.textMuted,
  },
  scenarioBase: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scenarioIdle: {
    borderColor: "rgba(111, 148, 211, 0.32)",
    backgroundColor: "rgba(10, 18, 34, 0.84)",
  },
  scenarioActive: {
    borderColor: "rgba(121, 245, 227, 0.78)",
    backgroundColor: "rgba(25, 78, 84, 0.62)",
  },
  scenarioPressed: {
    transform: [{ scale: 0.98 }],
  },
  scenarioEmoji: {
    fontSize: 14,
  },
  scenarioText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  scenarioTextIdle: {
    color: theme.colors.textSecondary,
  },
  scenarioTextActive: {
    color: "#E7FFFB",
  },
});
