import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import type { PlanBundle } from "@passport-quest/shared";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";
import { NeonButton } from "./NeonButton";
import { ReasonList } from "./ReasonList";

type PlanCardProps = {
  plan: PlanBundle;
  onOpen?: () => void;
  onStart?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  saving?: boolean;
};

export function PlanCard({
  plan,
  onOpen,
  onStart,
  onSave,
  onShare,
  saving = false,
}: PlanCardProps) {
  const heroImage = plan.stops[0]?.heroImageUrl;

  return (
    <Pressable accessibilityRole="button" onPress={onOpen}>
      <GlassCard style={styles.card}>
        <View style={styles.heroWrap}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroFallbackLabel}>Plan</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {plan.title}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {plan.summary}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaValue}>{plan.estimatedDurationMin} min</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaValue}>{plan.estimatedSpendBand} spend</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaValue}>{plan.stops.length} stop(s)</Text>
        </View>

        <ReasonList reasons={plan.whyRecommended} maxItems={2} style={styles.reasons} />

        <View style={styles.actionRow}>
          <NeonButton label="Find Plans" onPress={onStart} style={styles.startButton} />
          <NeonButton
            label={saving ? "Saving..." : "Save"}
            variant="secondary"
            onPress={onSave}
            disabled={saving}
            style={styles.smallButton}
          />
          <NeonButton
            label="Share"
            variant="secondary"
            onPress={onShare}
            style={styles.smallButton}
          />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: 18,
  },
  heroWrap: {
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroImage: {
    width: "100%",
    height: 168,
  },
  heroFallback: {
    height: 168,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.backgroundElevated,
  },
  heroFallbackLabel: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  summary: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  metaDot: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  metaValue: {
    color: "#91E9DC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  reasons: {
    marginTop: theme.spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  startButton: {
    flex: 1,
  },
  smallButton: {
    paddingHorizontal: theme.spacing.sm,
    minHeight: 44,
  },
});
