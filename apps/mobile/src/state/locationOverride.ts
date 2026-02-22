import { create } from "zustand";

type LocationOverride = {
  lat: number;
  lng: number;
  accuracyM: number;
  source: "app_test_location";
  updatedAt: string;
};

type LocationOverrideState = {
  override: LocationOverride | null;
  setOverride: (value: Omit<LocationOverride, "updatedAt">) => void;
  clearOverride: () => void;
};

export const useLocationOverrideStore = create<LocationOverrideState>((set) => ({
  override: null,
  setOverride: (value) =>
    set({
      override: {
        ...value,
        updatedAt: new Date().toISOString(),
      },
    }),
  clearOverride: () => set({ override: null }),
}));

