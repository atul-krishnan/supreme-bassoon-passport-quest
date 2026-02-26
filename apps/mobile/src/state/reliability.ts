import { create } from "zustand";
import type { CityId } from "@passport-quest/shared";

type CityNearbyReliability = {
  samples: number[];
  p95Ms: number | null;
  updatedAt: string | null;
};

type ReliabilityState = {
  nearbyByCity: Partial<Record<CityId, CityNearbyReliability>>;
  recordNearbyLatency: (cityId: CityId, latencyMs: number) => void;
};

export const NEARBY_RELEASE_GATE_MS = 800;
const NEARBY_SAMPLE_WINDOW = 25;

function computeP95(samples: number[]): number | null {
  if (samples.length === 0) {
    return null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const value = sorted[index];
  return Number.isFinite(value) ? Math.round(value) : null;
}

export const useReliabilityStore = create<ReliabilityState>((set) => ({
  nearbyByCity: {},
  recordNearbyLatency: (cityId, latencyMs) => {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }

    set((state) => {
      const previous = state.nearbyByCity[cityId];
      const nextSamples = [...(previous?.samples ?? []), Math.round(latencyMs)].slice(
        -NEARBY_SAMPLE_WINDOW,
      );

      return {
        nearbyByCity: {
          ...state.nearbyByCity,
          [cityId]: {
            samples: nextSamples,
            p95Ms: computeP95(nextSamples),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },
}));
