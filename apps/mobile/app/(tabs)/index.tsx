import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import type { PlanBundle, TripContextStartRequest } from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import {
  getRecommendedPlans,
  getSavedPlans,
  getUserSummary,
  savePlan,
  startTripContext,
  submitRecommendationFeedback,
} from "../../src/api/endpoints";
import { getCityAnchor } from "../../src/config/city";
import { useSessionStore } from "../../src/state/session";
import { theme } from "../../src/theme";
import {
  EmptyState,
  GlassCard,
  InlineError,
  LoadingShimmer,
  NeonButton,
  PlanCard,
  PlanContextSheet,
  ScreenContainer,
} from "../../src/ui";

type PlanContextInput = Omit<TripContextStartRequest, "cityId">;

export default function PlanScreen() {
  const queryClient = useQueryClient();
  const activeCityId = useSessionStore((state) => state.activeCityId);
  const cityAnchor = getCityAnchor(activeCityId);

  const [contextVisible, setContextVisible] = useState(false);
  const [activeTripContextId, setActiveTripContextId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanBundle[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const impressionRef = useRef<Set<string>>(new Set());

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const savedPlansPreviewQuery = useQuery({
    queryKey: ["saved-plans-preview", activeCityId],
    queryFn: () => getSavedPlans(5),
  });

  const recommendationFeedbackMutation = useMutation({
    mutationFn: submitRecommendationFeedback,
  });

  const submitFeedback = useCallback(
    (payload: Parameters<typeof submitRecommendationFeedback>[0]) => {
      recommendationFeedbackMutation.mutate(payload);
      trackUiEvent("recommendation_feedback_submitted", {
        tripContextId: payload.tripContextId,
        planId: payload.planId,
        questId: payload.questId ?? null,
        feedbackType: payload.feedbackType,
        surface: "plan_tab",
      });
    },
    [recommendationFeedbackMutation.mutate],
  );

  const startPlanContextMutation = useMutation({
    mutationFn: async (input: PlanContextInput) => {
      const context = await startTripContext({
        cityId: activeCityId,
        ...input,
      });

      trackUiEvent("trip_context_started", {
        tripContextId: context.tripContextId,
        cityId: activeCityId,
        contextType: input.contextType,
      });

      const recommended = await getRecommendedPlans({
        cityId: activeCityId,
        tripContextId: context.tripContextId,
        limit: 3,
      });

      return {
        contextId: context.tripContextId,
        plans: recommended.plans,
      };
    },
    onSuccess: (result) => {
      setActiveTripContextId(result.contextId);
      setPlans(result.plans);
      setPlansError(null);
      setContextVisible(false);
      impressionRef.current.clear();
    },
    onError: (error) => {
      setPlans([]);
      setPlansError(
        error instanceof Error ? error.message : "Could not generate plans.",
      );
    },
  });

  useEffect(() => {
    if (!activeTripContextId) {
      return;
    }

    for (const plan of plans) {
      if (impressionRef.current.has(plan.planId)) {
        continue;
      }

      impressionRef.current.add(plan.planId);
      trackUiEvent("recommended_quest_impression", {
        cityId: activeCityId,
        planId: plan.planId,
        tripContextId: activeTripContextId,
        surface: "plan_tab",
      });

      submitFeedback({
        tripContextId: activeTripContextId,
        planId: plan.planId,
        questId: plan.stops[0]?.questId,
        feedbackType: "shown",
        metadata: { surface: "plan_tab" },
      });
    }
  }, [
    activeCityId,
    activeTripContextId,
    plans,
    submitFeedback,
  ]);

  const openPlanDetail = (plan: PlanBundle, action: "opened" | "started") => {
    const firstStop = plan.stops[0];
    if (!firstStop) {
      return;
    }

    if (action === "opened") {
      trackUiEvent("recommended_quest_opened", {
        cityId: activeCityId,
        questId: firstStop.questId,
        planId: plan.planId,
      });
    } else {
      trackUiEvent("recommended_quest_started", {
        cityId: activeCityId,
        questId: firstStop.questId,
        planId: plan.planId,
      });
    }

    if (activeTripContextId) {
      submitFeedback({
        tripContextId: activeTripContextId,
        planId: plan.planId,
        questId: firstStop.questId,
        feedbackType: action,
        metadata: { surface: "plan_tab" },
      });
    }

    router.push({
      pathname: "/quest/[questId]",
      params: {
        questId: firstStop.questId,
        cityId: activeCityId,
        title: firstStop.title,
        description: firstStop.storySnippet || plan.summary,
        category: "landmark",
        xpReward: "100",
        badgeKey: "",
        source: "recommended",
        why: plan.whyRecommended.join("||"),
        planId: plan.planId,
        tripContextId: activeTripContextId ?? "",
        planPayload: JSON.stringify(plan),
      },
    });
  };

  const handleSavePlan = async (plan: PlanBundle) => {
    if (!activeTripContextId) {
      Alert.alert("Start a plan first", "Generate recommendations before saving.");
      return;
    }

    setSavingPlanId(plan.planId);
    try {
      await savePlan({
        planId: plan.planId,
        tripContextId: activeTripContextId,
        cityId: activeCityId,
        planPayload: plan,
      });
      submitFeedback({
        tripContextId: activeTripContextId,
        planId: plan.planId,
        questId: plan.stops[0]?.questId,
        feedbackType: "saved",
        metadata: { surface: "plan_tab" },
      });
      await queryClient.invalidateQueries({
        queryKey: ["saved-plans-preview", activeCityId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["saved-plans-count"],
      });
      Alert.alert("Saved", "Plan added to your saved list.");
    } catch (error) {
      Alert.alert(
        "Could not save plan",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleSharePlan = async (plan: PlanBundle) => {
    try {
      await Share.share({
        title: plan.title,
        message: `${plan.title}\n${plan.summary}\nDuration: ${plan.estimatedDurationMin} min\nSpend: ${plan.estimatedSpendBand}`,
      });
    } catch {
      // Ignore share cancellation/errors.
    }
  };

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {summaryQuery.data
            ? `Hey ${summaryQuery.data.user.username.split("_")[0]}`
            : "Stop scrolling. Start doing."}
        </Text>
        <Text style={styles.subtext}>
          Build a ready-to-go plan in under 2 minutes. {cityAnchor.label}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.primaryCtaCard}>
          <Text style={styles.primaryTitle}>Plan something now</Text>
          <Text style={styles.primaryBody}>
            Set context, time, and budget. We return a curated plan bundle with clear reasons.
          </Text>
          <NeonButton
            label="Plan Now"
            onPress={() => setContextVisible(true)}
            style={styles.primaryButton}
          />
        </GlassCard>

        <Text style={styles.sectionTitle}>Suggested plans</Text>
        {startPlanContextMutation.isPending ? (
          <LoadingShimmer label="Generating your plans..." />
        ) : null}
        {plansError ? <InlineError message={plansError} /> : null}

        {plans.length === 0 && !startPlanContextMutation.isPending ? (
          <EmptyState
            title="No plans yet"
            description="Tap Plan Now to generate personalized options."
          />
        ) : null}

        {plans.map((plan) => (
          <PlanCard
            key={plan.planId}
            plan={plan}
            onOpen={() => openPlanDetail(plan, "opened")}
            onStart={() => openPlanDetail(plan, "started")}
            onSave={() => void handleSavePlan(plan)}
            onShare={() => void handleSharePlan(plan)}
            saving={savingPlanId === plan.planId}
          />
        ))}

        <Text style={styles.sectionTitle}>Saved plans</Text>
        {savedPlansPreviewQuery.isLoading ? (
          <LoadingShimmer label="Loading saved plans..." />
        ) : null}
        {savedPlansPreviewQuery.error ? (
          <InlineError message="Could not load saved plans right now." />
        ) : null}
        {savedPlansPreviewQuery.isSuccess &&
        (savedPlansPreviewQuery.data.items?.length ?? 0) === 0 ? (
          <EmptyState
            title="No saved plans yet"
            description="Save a recommendation to access it quickly later."
          />
        ) : null}
        {(savedPlansPreviewQuery.data?.items ?? []).map((item) => (
          <GlassCard key={`saved-${item.planId}`} style={styles.savedPlanCard}>
            <Text style={styles.savedPlanTitle}>{item.planPayload.title}</Text>
            <Text style={styles.savedPlanMeta}>
              Updated {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
          </GlassCard>
        ))}
      </ScrollView>

      <PlanContextSheet
        visible={contextVisible}
        loading={startPlanContextMutation.isPending}
        onClose={() => setContextVisible(false)}
        onSubmit={(payload) => startPlanContextMutation.mutate(payload)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  greeting: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  subtext: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  primaryCtaCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  primaryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  primaryBody: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: theme.spacing.md,
    minHeight: 52,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  savedPlanCard: {
    gap: theme.spacing.xs,
  },
  savedPlanTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  savedPlanMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
