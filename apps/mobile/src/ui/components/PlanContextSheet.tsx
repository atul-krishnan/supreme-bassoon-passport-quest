import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

type Option<T extends string> = {
  label: string;
  value: T;
};

const CONTEXT_OPTIONS: Option<TripContextType>[] = [
  { label: "Solo", value: "solo" },
  { label: "Couple", value: "couple" },
  { label: "Friends", value: "friends" },
  { label: "Family", value: "family" },
];

const TIME_OPTIONS = [60, 120, 180, 240];

const BUDGET_OPTIONS: Option<PlanBudgetBand>[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

const PACE_OPTIONS: Option<TripPace>[] = [
  { label: "Relaxed", value: "relaxed" },
  { label: "Balanced", value: "balanced" },
  { label: "Active", value: "active" },
];

const VIBE_OPTIONS = [
  "chill",
  "romantic",
  "foodie",
  "outdoors",
  "culture",
  "nightlife",
];

function ToggleGroup<T extends string>(props: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{props.label}</Text>
      <View style={styles.optionWrap}>
        {props.options.map((option) => {
          const isActive = option.value === props.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => props.onChange(option.value)}
              style={[styles.optionChip, isActive ? styles.optionChipActive : undefined]}
            >
              <Text style={[styles.optionText, isActive ? styles.optionTextActive : undefined]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PlanContextSheet({
  visible,
  loading = false,
  initialValue,
  onClose,
  onSubmit,
}: PlanContextSheetProps) {
  const [contextType, setContextType] = useState<TripContextType>("solo");
  const [timeBudgetMin, setTimeBudgetMin] = useState(120);
  const [budget, setBudget] = useState<PlanBudgetBand>("medium");
  const [pace, setPace] = useState<TripPace>("balanced");
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setContextType(initialValue?.contextType ?? "solo");
    setTimeBudgetMin(initialValue?.timeBudgetMin ?? 120);
    setBudget(initialValue?.budget ?? "medium");
    setPace(initialValue?.pace ?? "balanced");
    setVibeTags(initialValue?.vibeTags ?? []);
    setErrorMessage(null);
  }, [initialValue, visible]);

  const timeOptions = useMemo(
    () => TIME_OPTIONS.map((value) => ({ label: `${value} min`, value })),
    [],
  );

  const toggleVibe = (value: string) => {
    setVibeTags((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const submit = () => {
    if (timeBudgetMin < 30 || timeBudgetMin > 720) {
      setErrorMessage("Time budget must be between 30 and 720 minutes.");
      return;
    }

    onSubmit({
      contextType,
      timeBudgetMin,
      budget,
      pace,
      vibeTags,
      constraints: {},
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
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Plan context</Text>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <ToggleGroup
              label="Who are you going with?"
              options={CONTEXT_OPTIONS}
              value={contextType}
              onChange={setContextType}
            />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>How much time do you have?</Text>
              <View style={styles.optionWrap}>
                {timeOptions.map((option) => {
                  const isActive = option.value === timeBudgetMin;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      onPress={() => setTimeBudgetMin(option.value)}
                      style={[styles.optionChip, isActive ? styles.optionChipActive : undefined]}
                    >
                      <Text
                        style={[styles.optionText, isActive ? styles.optionTextActive : undefined]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ToggleGroup
              label="Budget comfort"
              options={BUDGET_OPTIONS}
              value={budget}
              onChange={setBudget}
            />

            <ToggleGroup label="Pace" options={PACE_OPTIONS} value={pace} onChange={setPace} />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>Vibe (optional)</Text>
              <View style={styles.optionWrap}>
                {VIBE_OPTIONS.map((vibe) => {
                  const isActive = vibeTags.includes(vibe);
                  return (
                    <Pressable
                      key={vibe}
                      accessibilityRole="button"
                      onPress={() => toggleVibe(vibe)}
                      style={[styles.optionChip, isActive ? styles.optionChipActive : undefined]}
                    >
                      <Text
                        style={[styles.optionText, isActive ? styles.optionTextActive : undefined]}
                      >
                        {vibe}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.footer}>
            <NeonButton label="Generate Plans" loading={loading} onPress={submit} />
          </View>
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
    maxHeight: "88%",
    paddingBottom: theme.spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  closeLabel: {
    color: theme.colors.accentCyan,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  content: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  group: {
    gap: theme.spacing.xs,
  },
  groupLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  optionChip: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundElevated,
    paddingHorizontal: theme.spacing.sm,
    justifyContent: "center",
  },
  optionChipActive: {
    borderColor: theme.colors.accentCyan,
    backgroundColor: "#0F2A49",
  },
  optionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  optionTextActive: {
    color: theme.colors.textPrimary,
  },
  errorText: {
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 18,
    marginTop: theme.spacing.xs,
  },
  footer: {
    marginTop: theme.spacing.md,
  },
});
