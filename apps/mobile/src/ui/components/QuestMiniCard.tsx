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
  ctaLabel = "Start Plan",
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
            {quest.badgeLabel ? (
              <Text style={styles.badge}>{quest.badgeLabel}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ height: theme.spacing.sm }} />
        <View style={styles.actionRow}>
          <NeonButton
            label={ctaLabel}
            onPress={onStart}
            variant="primary"
            style={styles.actionButton}
          />
          <View style={styles.rewardPill}>
            <Text style={styles.rewardPillText}>+{quest.xpReward} XP</Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.sm,
    borderRadius: 18,
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  image: {
    width: 108,
    height: 92,
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
    fontSize: 20,
    lineHeight: 24,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    color: theme.colors.accentCyan,
    fontWeight: "600",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  rewardPill: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(248, 213, 117, 0.38)",
    backgroundColor: "rgba(73, 57, 22, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  rewardPillText: {
    color: "#FBE6A3",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
});
