import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  PlanBudgetBand,
  PlanBundle,
  TripContextStartRequest,
  TripContextType,
  TripPace,
} from "@passport-quest/shared";
import { trackUiEvent } from "../../src/analytics/events";
import {
  getHealth,
  getRecommendedPlans,
  getUserSummary,
  savePlan,
  startTripContext,
  submitRecommendationFeedback,
} from "../../src/api/endpoints";
import { getPrecuratedHeroPlans } from "../../src/config/heroPlans";
import { getCityAnchor, isCityLive } from "../../src/config/city";
import { useAssistantCacheStore } from "../../src/state/assistantCache";
import {
  NEARBY_RELEASE_GATE_MS,
  useReliabilityStore,
} from "../../src/state/reliability";
import { useSessionStore } from "../../src/state/session";
import { theme } from "../../src/theme";
import {
  BadgeChip,
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

type ScenarioPreset = {
  id: "date-night" | "friends-hangout" | "solo-adventure";
  label: string;
  emoji: string;
  contextType: TripContextType;
  timeBudgetMin: number;
  budget: PlanBudgetBand;
  pace: TripPace;
  vibeTags: string[];
};

type AssistantPlanSource = "live" | "cache" | "curated";

type PlanLoadResult = {
  contextId: string | null;
  plans: PlanBundle[];
  source: AssistantPlanSource;
  fallbackReason?: "release_gate" | "timeout" | "request_error" | "empty_response";
};

const HERO_XP_REWARD = 50;
const LIVE_RECOMMENDATION_TIMEOUT_MS = 1400;
const TRUST_SIGNAL_FALLBACK = "Recommended because it's a local favorite";
const EMPTY_HERO_PLANS: PlanBundle[] = [];

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "date-night",
    label: "Date Night",
    emoji: "💕",
    contextType: "couple",
    timeBudgetMin: 140,
    budget: "medium",
    pace: "relaxed",
    vibeTags: ["romantic", "dinner"],
  },
  {
    id: "friends-hangout",
    label: "Friends Hangout",
    emoji: "🍻",
    contextType: "friends",
    timeBudgetMin: 100,
    budget: "medium",
    pace: "balanced",
    vibeTags: ["social", "food"],
  },
  {
    id: "solo-adventure",
    label: "Solo Adventure",
    emoji: "🧭",
    contextType: "solo",
    timeBudgetMin: 110,
    budget: "low",
    pace: "active",
    vibeTags: ["local", "landmark"],
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { emoji: "🌅", text: "Good morning" };
  }
  if (hour < 17) {
    return { emoji: "☀️", text: "Good afternoon" };
  }
  return { emoji: "🌙", text: "Good evening" };
}

function contextTypeLabel(contextType: TripContextType): string {
  if (contextType === "couple") {
    return "Couples";
  }
  if (contextType === "friends") {
    return "Friends";
  }
  if (contextType === "family") {
    return "Families";
  }
  return "Solo";
}

function resolveTrustSignal(plan: PlanBundle | null, cityLabel: string): string {
  if (!plan) {
    return `Recommended because it's a local favorite in ${cityLabel}`;
  }
  if (typeof plan.trust_signal === "string" && plan.trust_signal.trim().length > 0) {
    return plan.trust_signal.trim();
  }
  if (typeof plan.reason_string === "string" && plan.reason_string.trim().length > 0) {
    return plan.reason_string.trim();
  }
  const reason = plan.whyRecommended.find((item) => item.trim().length > 0);
  return reason ?? TRUST_SIGNAL_FALLBACK;
}

function buildContextInput(
  scenario: ScenarioPreset,
  contextType: TripContextType,
): PlanContextInput {
  return {
    contextType,
    timeBudgetMin: scenario.timeBudgetMin,
    budget: scenario.budget,
    pace: scenario.pace,
    vibeTags: scenario.vibeTags,
    constraints: {
      scenarioId: scenario.id,
      source: "assistant_home",
    },
  };
}

function buildFallbackNotice(
  cityLabel: string,
  reason: PlanLoadResult["fallbackReason"],
): string {
  if (reason === "release_gate") {
    return `Using quick picks for ${cityLabel} while nearby latency stabilizes.`;
  }
  if (reason === "timeout") {
    return "Live recommendations are slow right now. Quick picks are ready instantly.";
  }
  if (reason === "request_error") {
    return "Live recommendations are temporarily unavailable. Showing reliable quick picks.";
  }
  return "No live picks yet. Showing trusted quick picks.";
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

export default function PlanScreen() {
  const queryClient = useQueryClient();
  const activeCityId = useSessionStore((state) => state.activeCityId);
  const cityAnchor = getCityAnchor(activeCityId);
  const citySupportsLiveApi = isCityLive(activeCityId);

  const nearbyP95Ms = useReliabilityStore(
    (state) => state.nearbyByCity[activeCityId]?.p95Ms ?? null,
  );
  const cachedHeroPlansFromStore = useAssistantCacheStore(
    (state) => state.heroPlansByCity[activeCityId]?.plans,
  );
  const cachedHeroPlans = cachedHeroPlansFromStore ?? EMPTY_HERO_PLANS;
  const setHeroPlansCache = useAssistantCacheStore((state) => state.setHeroPlans);

  const [contextVisible, setContextVisible] = useState(false);
  const [activeTripContextId, setActiveTripContextId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanBundle[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<ScenarioPreset["id"]>("date-night");
  const [selectedCompanion, setSelectedCompanion] = useState<TripContextType>(
    "couple",
  );

  const autoLoadedCityRef = useRef<string | null>(null);
  const impressionRef = useRef<Set<string>>(new Set());

  const activeScenario = useMemo(
    () =>
      SCENARIO_PRESETS.find((scenario) => scenario.id === selectedScenarioId) ??
      SCENARIO_PRESETS[0],
    [selectedScenarioId],
  );

  const topPick = plans[0] ?? null;
  const morePicks = plans.slice(1);
  const trustSignal = useMemo(
    () => resolveTrustSignal(topPick, cityAnchor.label),
    [topPick, cityAnchor.label],
  );
  const heroImages =
    topPick?.stops
      .map((stop) => stop.heroImageUrl)
      .filter((url): url is string => typeof url === "string" && url.length > 0)
      .slice(0, 2) ?? [];

  const summaryQuery = useQuery({
    queryKey: ["user-summary"],
    queryFn: () => getUserSummary(),
  });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => getHealth(),
    staleTime: 60_000,
    retry: 1,
  });

  const nearbyGateBreachedFromHealth =
    healthQuery.data?.releaseGates?.nearbyApiGatePassed === false;
  const nearbyGateBreachedFromLocalSamples =
    nearbyP95Ms !== null && nearbyP95Ms > NEARBY_RELEASE_GATE_MS;
  const isNearbyGateBreached =
    nearbyGateBreachedFromHealth || nearbyGateBreachedFromLocalSamples;

  const resolveFallbackPlans = useCallback(
    (contextType: TripContextType): Pick<PlanLoadResult, "plans" | "source"> => {
      if (cachedHeroPlans.length > 0) {
        return {
          plans: cachedHeroPlans,
          source: "cache",
        };
      }

      return {
        plans: getPrecuratedHeroPlans(activeCityId, contextType),
        source: "curated",
      };
    },
    [activeCityId, cachedHeroPlans],
  );

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
    onMutate: (input) => {
      const fallback = resolveFallbackPlans(input.contextType);
      setPlans(fallback.plans);
      setPlansError(null);
      setActiveTripContextId(null);

      if (!citySupportsLiveApi || isNearbyGateBreached) {
        setAssistantNotice(buildFallbackNotice(cityAnchor.label, "release_gate"));
        return;
      }

      setAssistantNotice(
        fallback.source === "cache"
          ? "Refreshing with live picks..."
          : `Loading fresh picks for ${cityAnchor.label}...`,
      );
    },
    mutationFn: async (input: PlanContextInput): Promise<PlanLoadResult> => {
      const fallback = resolveFallbackPlans(input.contextType);

      if (!citySupportsLiveApi || isNearbyGateBreached) {
        return {
          contextId: null,
          plans: fallback.plans,
          source: fallback.source,
          fallbackReason: "release_gate",
        };
      }

      try {
        const context = await withTimeout(
          startTripContext({
            cityId: activeCityId,
            ...input,
          }),
          LIVE_RECOMMENDATION_TIMEOUT_MS,
          "Trip context timed out",
        );

        trackUiEvent("trip_context_started", {
          tripContextId: context.tripContextId,
          cityId: activeCityId,
          contextType: input.contextType,
        });

        const recommended = await withTimeout(
          getRecommendedPlans({
            cityId: activeCityId,
            tripContextId: context.tripContextId,
            limit: 3,
          }),
          LIVE_RECOMMENDATION_TIMEOUT_MS,
          "Recommended plans timed out",
        );

        if (recommended.plans.length === 0) {
          return {
            contextId: null,
            plans: fallback.plans,
            source: fallback.source,
            fallbackReason: "empty_response",
          };
        }

        return {
          contextId: context.tripContextId,
          plans: recommended.plans,
          source: "live",
        };
      } catch (error) {
        return {
          contextId: null,
          plans: fallback.plans,
          source: fallback.source,
          fallbackReason: error instanceof TimeoutError ? "timeout" : "request_error",
        };
      }
    },
    onSuccess: (result) => {
      setActiveTripContextId(result.contextId);
      setPlans(result.plans);
      setContextVisible(false);
      impressionRef.current.clear();

      if (result.source === "live") {
        setHeroPlansCache(activeCityId, result.plans);
        setAssistantNotice(null);
        setPlansError(null);
        return;
      }

      setPlansError(null);
      setAssistantNotice(buildFallbackNotice(cityAnchor.label, result.fallbackReason));
    },
    onError: (error) => {
      setPlans([]);
      setPlansError(
        error instanceof Error ? error.message : "Could not generate plans.",
      );
    },
  });

  useEffect(() => {
    if (autoLoadedCityRef.current === activeCityId) {
      return;
    }

    autoLoadedCityRef.current = activeCityId;

    const initialInput = buildContextInput(activeScenario, activeScenario.contextType);
    const fallback = resolveFallbackPlans(initialInput.contextType);
    setSelectedCompanion(initialInput.contextType);
    setPlans(fallback.plans);
    setPlansError(null);
    setActiveTripContextId(null);
    if (!citySupportsLiveApi || isNearbyGateBreached) {
      setAssistantNotice(buildFallbackNotice(cityAnchor.label, "release_gate"));
    } else {
      setAssistantNotice(
        fallback.source === "cache"
          ? "Refreshing with live picks..."
          : `Loading fresh picks for ${cityAnchor.label}...`,
      );
    }
    startPlanContextMutation.mutate(initialInput);
  }, [
    activeCityId,
    activeScenario,
    cityAnchor.label,
    citySupportsLiveApi,
    isNearbyGateBreached,
    resolveFallbackPlans,
    startPlanContextMutation,
  ]);

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
  }, [activeCityId, activeTripContextId, plans, submitFeedback]);

  const openPlanDetail = (plan: PlanBundle, action: "opened" | "started") => {
    const firstStop = plan.stops[0];
    if (!firstStop) {
      return;
    }

    trackUiEvent(
      action === "started" ? "recommended_quest_started" : "recommended_quest_opened",
      {
        cityId: activeCityId,
        questId: firstStop.questId,
        planId: plan.planId,
      },
    );

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
        xpReward: String(HERO_XP_REWARD),
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
      Alert.alert(
        "Start a plan first",
        "Pick a recommendation before saving.",
      );
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
        message: `${plan.title}\n${plan.summary}`,
      });
    } catch {
      // Ignore share cancellation/errors.
    }
  };

  const handleScenarioPress = (scenario: ScenarioPreset) => {
    setSelectedScenarioId(scenario.id);
    setSelectedCompanion(scenario.contextType);
    setContextVisible(false);
    setPlansError(null);
    const input = buildContextInput(scenario, scenario.contextType);
    const fallback = resolveFallbackPlans(input.contextType);
    setPlans(fallback.plans);
    setActiveTripContextId(null);
    if (!citySupportsLiveApi || isNearbyGateBreached) {
      setAssistantNotice(buildFallbackNotice(cityAnchor.label, "release_gate"));
    } else {
      setAssistantNotice(
        fallback.source === "cache"
          ? "Refreshing with live picks..."
          : `Loading fresh picks for ${cityAnchor.label}...`,
      );
    }
    startPlanContextMutation.mutate(input);
  };

  const userLabel = summaryQuery.data?.user.username.split("_")[0] ?? "Explorer";
  const greeting = getGreeting();
  const loadingHero = startPlanContextMutation.isPending && !topPick;

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <Text style={styles.tagline}>
          Stop scrolling.
          {"\n"}
          <Text style={styles.taglineAccent}>Start doing.</Text>
        </Text>
        <Text style={styles.subtext}>
          {greeting.emoji} {greeting.text}, {userLabel}. Your {cityAnchor.label} plan is ready.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.topPickCard}>
          <Text style={styles.cardEyebrow}>Top Pick for You</Text>
          <View style={styles.trustSignalChip}>
            <Text style={styles.trustSignalText}>✨ {trustSignal}</Text>
          </View>

          {assistantNotice ? (
            <Text style={styles.assistantNotice}>{assistantNotice}</Text>
          ) : null}

          <Text style={styles.topPickTitle}>
            {topPick ? topPick.title : "Finding your plan…"}
          </Text>

          <View style={styles.logisticsRow}>
            <Text style={styles.logisticChip}>⏱ {topPick?.estimatedDurationMin ?? activeScenario.timeBudgetMin}m</Text>
            <Text style={styles.logisticDot}>·</Text>
            <Text style={styles.logisticChip}>💰 {(topPick?.estimatedSpendBand ?? activeScenario.budget)}</Text>
            <Text style={styles.logisticDot}>·</Text>
            <Text style={styles.logisticChip}>🚩 {topPick?.stops.length ?? 1} stop{(topPick?.stops.length ?? 1) !== 1 ? "s" : ""}</Text>
          </View>

          {heroImages.length > 0 ? (
            <View style={styles.heroRow}>
              <Image
                source={{ uri: heroImages[0] }}
                style={[
                  styles.heroImage,
                  heroImages.length === 1 ? styles.heroImageSolo : undefined,
                ]}
              />
              {heroImages[1] ? (
                <Image source={{ uri: heroImages[1] }} style={styles.heroImage} />
              ) : null}
            </View>
          ) : loadingHero ? (
            <LoadingShimmer label="Curating your perfect plan…" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>
                Tap below to tell the assistant who&apos;s joining.
              </Text>
            </View>
          )}

          <View style={styles.heroPrimaryActionRow}>
            <NeonButton
              label="Let's Go"
              onPress={() => {
                if (topPick) {
                  openPlanDetail(topPick, "started");
                  return;
                }
                setContextVisible(true);
              }}
              style={styles.heroPrimaryButton}
            />
            <View style={styles.heroXpPill}>
              <Text style={styles.heroXpText}>⭐ Earn +{HERO_XP_REWARD} XP</Text>
            </View>
          </View>

          <NeonButton
            label="Find Something Else"
            variant="secondary"
            onPress={() => setContextVisible(true)}
            style={styles.heroSecondaryButton}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore city map"
            onPress={() => router.push("/(tabs)/explore")}
            style={styles.exploreLink}
          >
            <Text style={styles.exploreLinkLabel}>Explore Map</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.scenarioSection}>
          <Text style={styles.scenarioLabel}>Smart Shortcuts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scenarioRow}
          >
            {SCENARIO_PRESETS.map((scenario) => (
              <BadgeChip
                key={scenario.id}
                variant="scenario"
                label={scenario.label}
                emoji={scenario.emoji}
                active={scenario.id === selectedScenarioId}
                onPress={() => handleScenarioPress(scenario)}
              />
            ))}
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>
          More for {contextTypeLabel(selectedCompanion)}
        </Text>

        {__DEV__ && healthQuery.data?.releaseGates ? (
          <Text style={styles.healthMeta}>
            Nearby p95: {healthQuery.data.releaseGates.nearbyApiP95Ms ?? "n/a"}ms
          </Text>
        ) : null}

        {__DEV__ && nearbyP95Ms !== null ? (
          <Text style={styles.healthMeta}>Local nearby p95: {nearbyP95Ms}ms</Text>
        ) : null}

        {plansError ? <InlineError message={plansError} /> : null}

        {plans.length === 0 && !startPlanContextMutation.isPending ? (
          <EmptyState
            title="No picks yet"
            description="Tap Find Something Else and answer one quick question."
            icon="sparkles-outline"
          />
        ) : null}

        {morePicks.map((plan) => (
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
      </ScrollView>

      <PlanContextSheet
        visible={contextVisible}
        loading={startPlanContextMutation.isPending}
        initialValue={{
          contextType: selectedCompanion,
          timeBudgetMin: activeScenario.timeBudgetMin,
          budget: activeScenario.budget,
          pace: activeScenario.pace,
          vibeTags: activeScenario.vibeTags,
          constraints: {
            scenarioId: activeScenario.id,
            source: "assistant_home_sheet",
          },
        }}
        onClose={() => setContextVisible(false)}
        onSubmit={(payload) => {
          setSelectedCompanion(payload.contextType);
          setContextVisible(false);
          startPlanContextMutation.mutate(payload);
        }}
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
  tagline: {
    color: "#F4F8FF",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  taglineAccent: {
    color: theme.colors.primaryAction,
  },
  subtext: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: theme.typography.body.fontFamily,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 128,
    gap: theme.spacing.md,
  },
  topPickCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  cardEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: theme.typography.caption.fontFamily,
  },
  trustSignalChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(132, 240, 228, 0.42)",
    backgroundColor: "rgba(39, 106, 101, 0.32)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    marginBottom: theme.spacing.xs,
  },
  trustSignalText: {
    color: "#DDFEF8",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    fontFamily: theme.typography.body.fontFamily,
  },
  assistantNotice: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.caption.fontFamily,
  },
  topPickTitle: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  logisticsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  logisticChip: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
    fontFamily: theme.typography.caption.fontFamily,
  },
  logisticDot: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "400",
  },
  heroRow: {
    marginTop: theme.spacing.xs,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  heroImage: {
    width: "49%",
    height: 126,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(123, 162, 227, 0.34)",
  },
  heroImageSolo: {
    width: "100%",
  },
  heroPlaceholder: {
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(120, 156, 219, 0.28)",
    borderRadius: theme.radius.md,
    minHeight: 108,
    backgroundColor: "rgba(9, 16, 33, 0.74)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  heroPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: theme.typography.body.fontFamily,
  },
  heroPrimaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  heroPrimaryButton: {
    flex: 1,
  },
  heroXpPill: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(248, 213, 117, 0.38)",
    backgroundColor: "rgba(73, 57, 22, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  heroXpText: {
    color: "#FBE6A3",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroSecondaryButton: {
    marginTop: theme.spacing.xs,
  },
  exploreLink: {
    alignSelf: "flex-start",
    marginTop: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(132, 240, 228, 0.36)",
    paddingBottom: 1,
    minHeight: 24,
  },
  exploreLinkLabel: {
    color: theme.colors.accentCyan,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily: theme.typography.caption.fontFamily,
  },
  scenarioSection: {
    gap: theme.spacing.xs,
  },
  scenarioLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    fontFamily: theme.typography.body.fontFamily,
  },
  scenarioRow: {
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: theme.typography.display.fontFamily,
  },
  healthMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.typography.caption.fontFamily,
  },
});
