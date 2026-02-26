import { create } from "zustand";
import type { CityId, PlanBundle } from "@passport-quest/shared";

type AssistantCacheEntry = {
  plans: PlanBundle[];
  updatedAt: string;
};

type AssistantCacheState = {
  heroPlansByCity: Partial<Record<CityId, AssistantCacheEntry>>;
  setHeroPlans: (cityId: CityId, plans: PlanBundle[]) => void;
};

export const useAssistantCacheStore = create<AssistantCacheState>((set) => ({
  heroPlansByCity: {},
  setHeroPlans: (cityId, plans) => {
    const normalizedPlans = plans.slice(0, 3);
    if (normalizedPlans.length === 0) {
      return;
    }

    set((state) => ({
      heroPlansByCity: {
        ...state.heroPlansByCity,
        [cityId]: {
          plans: normalizedPlans,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },
}));
