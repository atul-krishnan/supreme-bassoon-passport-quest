import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type {
  PlanBudgetBand,
  TripContextStartRequest,
  TripContextType,
  TripPace,
} from "@passport-quest/shared";
import { theme } from "../../theme";
import { GlassCard } from "./GlassCard";
import { NeonButton } from "./NeonButton";

type PlanContextInput = Omit<TripContextStartRequest, "cityId">;

type PlanContextSheetProps = {
  visible: boolean;
  loading?: boolean;
  initialValue?: Partial<PlanContextInput>;
  onClose: () => void;
  onSubmit: (payload: PlanContextInput) => void;
};

type CompanionOption = {
  label: string;
  value: TripContextType;
  emoji: string;
};

const COMPANION_OPTIONS: CompanionOption[] = [
  { label: "Solo", value: "solo", emoji: "🧍" },
  { label: "Couple", value: "couple", emoji: "💑" },
  { label: "Friends", value: "friends", emoji: "👯" },
  { label: "Family", value: "family", emoji: "👨‍👩‍👧" },
];

function normalizeBudget(value: unknown): PlanBudgetBand {
  if (value === "low" || value === "high") {
    return value;
  }
  return "medium";
}

function normalizePace(value: unknown): TripPace {
  if (value === "relaxed" || value === "active") {
    return value;
  }
  return "balanced";
}

export function PlanContextSheet({
  visible,
  loading = false,
  initialValue,
  onClose,
  onSubmit,
}: PlanContextSheetProps) {
  const defaultContextType: TripContextType = initialValue?.contextType ?? "solo";
  const defaultTimeBudgetMin =
    typeof initialValue?.timeBudgetMin === "number"
      ? Math.min(720, Math.max(30, Math.floor(initialValue.timeBudgetMin)))
      : 120;
  const defaultBudget = normalizeBudget(initialValue?.budget);
  const defaultPace = normalizePace(initialValue?.pace);
  const defaultVibeTags = Array.isArray(initialValue?.vibeTags)
    ? initialValue.vibeTags
    : [];
  const defaultConstraints =
    initialValue?.constraints && typeof initialValue.constraints === "object"
      ? initialValue.constraints
      : {};

  const submit = (contextType: TripContextType) => {
    onSubmit({
      contextType,
      timeBudgetMin: defaultTimeBudgetMin,
      budget: defaultBudget,
      pace: defaultPace,
      vibeTags: defaultVibeTags,
      constraints: defaultConstraints,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <GlassCard style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Who's joining you?</Text>
          <Text style={styles.subtitle}>Pick one. I'll handle the rest.</Text>
          <View style={styles.optionGrid}>
            {COMPANION_OPTIONS.map((option) => (
              <NeonButton
                key={option.value}
                label={`${option.emoji} ${option.label}`}
                variant={option.value === defaultContextType ? "primary" : "secondary"}
                onPress={() => submit(option.value)}
                loading={loading && option.value === defaultContextType}
                disabled={loading}
                style={styles.optionButton}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            disabled={loading}
            style={styles.dismiss}
          >
            <Text style={styles.dismissLabel}>Not now</Text>
          </Pressable>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(1, 4, 12, 0.62)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(168, 186, 224, 0.48)",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 18,
  },
  optionGrid: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  optionButton: {
    width: "48%",
    minHeight: 64,
    borderRadius: theme.radius.lg,
  },
  dismiss: {
    alignSelf: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  dismissLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
