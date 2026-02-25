import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";
import type { FeedEventViewModel } from "../types";

type FeedEventCardProps = {
  event: FeedEventViewModel;
};

export function FeedEventCard({ event }: FeedEventCardProps) {
  const accentColor =
    event.accent === "green"
      ? theme.colors.accentGreen
      : event.accent === "purple"
        ? theme.colors.accentPurple
        : theme.colors.accentCyan;

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.actor, { color: accentColor }]} numberOfLines={1}>
        {event.actorName}
      </Text>
      <Text style={styles.message}>{event.message}</Text>
      <View style={{ height: theme.spacing.xs }} />
      <Text style={styles.time}>{event.relativeTime}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  actor: {
    fontSize: 17,
    fontWeight: "700",
  },
  message: {
    color: theme.colors.textPrimary,
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
