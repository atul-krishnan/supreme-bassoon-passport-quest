import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";
import type { FeedEventViewModel } from "../types";

type FeedEventCardProps = {
  event: FeedEventViewModel;
};

function getEventIcon(message: string): {
  name: keyof typeof Ionicons.glyphMap;
  bg: string;
} {
  if (message.includes("badge")) {
    return { name: "ribbon", bg: "rgba(143, 99, 255, 0.22)" };
  }
  if (message.includes("quest") || message.includes("XP")) {
    return { name: "flash", bg: "rgba(46, 246, 168, 0.18)" };
  }
  if (message.includes("friend")) {
    return { name: "people", bg: "rgba(58, 215, 255, 0.18)" };
  }
  if (message.includes("streak")) {
    return { name: "flame", bg: "rgba(249, 199, 79, 0.22)" };
  }
  return { name: "sparkles", bg: "rgba(58, 215, 255, 0.14)" };
}

export function FeedEventCard({ event }: FeedEventCardProps) {
  const accentColor =
    event.accent === "green"
      ? theme.colors.accentGreen
      : event.accent === "purple"
        ? theme.colors.accentPurple
        : theme.colors.accentCyan;

  const icon = getEventIcon(event.message);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={20} color={accentColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.actor, { color: accentColor }]} numberOfLines={1}>
            {event.actorName}
          </Text>
          <Text style={styles.message} numberOfLines={2}>{event.message}</Text>
          <Text style={styles.time}>{event.relativeTime}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  actor: {
    fontSize: 16,
    fontWeight: "700",
  },
  message: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
