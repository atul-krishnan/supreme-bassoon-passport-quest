import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";
import { NeonButton } from "./NeonButton";
import type { QuestCardViewModel } from "../types";
import { HERO_BY_CATEGORY } from "../questAssets";

type QuestMiniCardProps = {
  quest: QuestCardViewModel;
  onStart?: () => void;
  onPress?: () => void;
  compact?: boolean;
  ctaLabel?: string;
};

export function QuestMiniCard({
  quest,
  onStart,
  onPress,
  compact = false,
  ctaLabel = "Start",
}: QuestMiniCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <Image
            source={{ uri: HERO_BY_CATEGORY[quest.category] }}
            style={[styles.image, compact ? styles.imageCompact : undefined]}
          />
          <View style={styles.meta}>
            <Text style={styles.title}>{quest.title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {quest.subtitle}
            </Text>
            <Text style={styles.reward}>Reward: {quest.xpReward} XP</Text>
            {quest.badgeLabel ? (
              <Text style={styles.badge}>{quest.badgeLabel}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ height: theme.spacing.sm }} />
        <NeonButton label={ctaLabel} onPress={onStart} variant="primary" />
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  image: {
    width: 98,
    height: 88,
    borderRadius: theme.radius.md,
  },
  imageCompact: {
    width: 86,
    height: 76,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 17,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  reward: {
    color: theme.colors.accentGreen,
    fontWeight: "700",
    fontSize: 13,
  },
  badge: {
    color: theme.colors.accentCyan,
    fontWeight: "600",
    fontSize: 12,
  },
});
