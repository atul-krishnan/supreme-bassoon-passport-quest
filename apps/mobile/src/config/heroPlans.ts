import type {
  CityId,
  PlanBudgetBand,
  PlanBundle,
  TripContextType,
} from "@passport-quest/shared";
import { getCityAnchor } from "./city";

type CuratedStopSeed = {
  title: string;
  storySnippet: string;
  visitDurationMin: number;
};

type CuratedContextSeed = {
  title: string;
  summary: string;
  estimatedDurationMin: number;
  estimatedSpendBand: PlanBudgetBand;
  trustSignal: string;
  why: string;
  stops: CuratedStopSeed[];
};

const CURATED_CONTEXT_LIBRARY: Record<TripContextType, CuratedContextSeed> = {
  solo: {
    title: "Solo Adventure Sprint",
    summary: "A focused route with high signal and low decision fatigue.",
    estimatedDurationMin: 105,
    estimatedSpendBand: "low",
    trustSignal: "✨ Quietly trending among solo explorers this week",
    why: "Optimized for independent plans with minimal wait times",
    stops: [
      {
        title: "Independent Coffee Stop",
        storySnippet: "Start with a short reset and set your pace.",
        visitDurationMin: 35,
      },
      {
        title: "Neighborhood Walk",
        storySnippet: "A compact discovery loop with photo-friendly spots.",
        visitDurationMin: 70,
      },
    ],
  },
  couple: {
    title: "Date Night Momentum",
    summary: "A smooth two-stop evening plan with easy transitions.",
    estimatedDurationMin: 130,
    estimatedSpendBand: "medium",
    trustSignal: "💫 Recommended because couples keep finishing this route",
    why: "Balanced ambience, good pacing, and strong completion rate",
    stops: [
      {
        title: "Signature Dinner Spot",
        storySnippet: "Start with a comfortable table and relaxed service.",
        visitDurationMin: 75,
      },
      {
        title: "Dessert + Short Walk",
        storySnippet: "Close with an easy post-dinner stretch.",
        visitDurationMin: 55,
      },
    ],
  },
  friends: {
    title: "Friends Hangout Stack",
    summary: "High-energy plan tuned for easy group coordination.",
    estimatedDurationMin: 120,
    estimatedSpendBand: "medium",
    trustSignal: "🔥 Trending for friend groups tonight",
    why: "Built for social energy and low split-bill friction",
    stops: [
      {
        title: "Group-first Food Hub",
        storySnippet: "Quick seating and menu depth for mixed tastes.",
        visitDurationMin: 70,
      },
      {
        title: "Late-evening Add-on",
        storySnippet: "A short follow-up stop to keep the momentum.",
        visitDurationMin: 50,
      },
    ],
  },
  family: {
    title: "Family Friendly Circuit",
    summary: "Comfortable pacing with reliable amenities for everyone.",
    estimatedDurationMin: 140,
    estimatedSpendBand: "medium",
    trustSignal: "✅ Reliable pick for family outings this weekend",
    why: "Family-safe flow with predictable timing and easy access",
    stops: [
      {
        title: "Kid-friendly Main Stop",
        storySnippet: "Space, seating, and flexible timing for families.",
        visitDurationMin: 80,
      },
      {
        title: "Easy Wind-down Stop",
        storySnippet: "A short final stop with low transit overhead.",
        visitDurationMin: 60,
      },
    ],
  },
};

export function getPrecuratedHeroPlans(
  cityId: CityId,
  contextType: TripContextType,
): PlanBundle[] {
  const cityAnchor = getCityAnchor(cityId);
  const seed = CURATED_CONTEXT_LIBRARY[contextType];
  const fallbackReason = `Recommended because it's a local favorite in ${cityAnchor.label}`;

  const buildPlan = (suffix: "primary" | "backup", summaryVariant?: string): PlanBundle => ({
    planId: `curated-${cityId}-${contextType}-${suffix}`,
    title: `${cityAnchor.label} ${seed.title}`,
    summary: summaryVariant ?? seed.summary,
    estimatedDurationMin: seed.estimatedDurationMin,
    estimatedSpendBand: seed.estimatedSpendBand,
    whyRecommended: [seed.why, fallbackReason],
    trust_signal: seed.trustSignal,
    reason_string: fallbackReason,
    stops: seed.stops.map((stop, index) => ({
      questId: `curated-${cityId}-${contextType}-${suffix}-stop-${index + 1}`,
      title: stop.title,
      order: index + 1,
      visitDurationMin: stop.visitDurationMin,
      storySnippet: stop.storySnippet,
      practicalDetails: [
        `Use this as a quick-start plan for ${cityAnchor.label}.`,
      ],
      reason_string: fallbackReason,
    })),
  });

  return [
    buildPlan("primary"),
    buildPlan(
      "backup",
      "Fallback route selected to keep decision speed high while systems recover.",
    ),
  ];
}
