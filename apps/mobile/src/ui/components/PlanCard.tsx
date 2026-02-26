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

function resolveTrustSignal(plan: PlanBundle): string {
  if (typeof plan.trust_signal === "string" && plan.trust_signal.trim().length > 0) {
    return plan.trust_signal.trim();
  }
  if (typeof plan.reason_string === "string" && plan.reason_string.trim().length > 0) {
    return plan.reason_string.trim();
  }
  const fallback = plan.whyRecommended.find((reason) => reason.trim().length > 0);
  return fallback ?? "Recommended because it's a local favorite";
}

export function PlanCard({
  plan,
  onOpen,
  onStart,
  onSave,
  onShare,
  saving = false,
}: PlanCardProps) {
  const heroImage = plan.stops[0]?.heroImageUrl;
  const trustSignal = resolveTrustSignal(plan);

  return (
    <Pressable accessibilityRole="button" onPress={onOpen}>
      <GlassCard style={styles.card}>
        <Text style={styles.trustLabel}>Trust Signal</Text>
        <View style={styles.trustPill}>
          <Text style={styles.trustText}>✨ {trustSignal}</Text>
        </View>

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
          <NeonButton label="Start Plan" onPress={onStart} style={styles.startButton} />
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
  trustLabel: {
    color: "#A9EDE3",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  trustPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(132, 240, 228, 0.42)",
    backgroundColor: "rgba(39, 106, 101, 0.32)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    marginTop: -4,
  },
  trustText: {
    color: "#DDFEF8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
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
