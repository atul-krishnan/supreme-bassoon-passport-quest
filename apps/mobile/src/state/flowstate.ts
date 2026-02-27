import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  EnergyBaseline,
  FlowDiagnosticResponse,
  FocusPillar,
  FrictionPoint,
  HeroPlay,
  MarkPlayStepDoneResponse,
  PlaySession,
} from "@passport-quest/shared";

type FlowDiagnosticDraft = {
  energyBaseline: EnergyBaseline | null;
  focusPillar: FocusPillar | null;
  frictionPoint: FrictionPoint | null;
  completedAt: string | null;
};

type FlowExecutionState = {
  session: PlaySession | null;
  remainingSec: number;
  timerRunning: boolean;
};

type FlowMetrics = {
  xpTotal: number;
  level: number;
  playsCompleted: number;
  decisionsSaved: number;
  planningMinutesSaved: number;
};

type FlowState = {
  diagnostic: FlowDiagnosticDraft;
  heroPlay: HeroPlay | null;
  execution: FlowExecutionState;
  metrics: FlowMetrics;
  setEnergyBaseline: (value: EnergyBaseline) => void;
  setFocusPillar: (value: FocusPillar) => void;
  setFrictionPoint: (value: FrictionPoint) => void;
  applyDiagnostic: (payload: FlowDiagnosticResponse) => void;
  setHeroPlay: (heroPlay: HeroPlay | null) => void;
  setExecutionSession: (session: PlaySession | null) => void;
  setRemainingSec: (seconds: number) => void;
  setTimerRunning: (running: boolean) => void;
  applyStepResult: (result: MarkPlayStepDoneResponse) => void;
  syncMetrics: (metrics: Partial<FlowMetrics>) => void;
  resetFlowExecution: () => void;
};

const FLOWSTATE_STORAGE_KEY = "pq_flowstate_store";

const secureStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

const initialMetrics: FlowMetrics = {
  xpTotal: 0,
  level: 1,
  playsCompleted: 0,
  decisionsSaved: 0,
  planningMinutesSaved: 0,
};

export const useFlowStateStore = create<FlowState>()(
  persist(
    (set) => ({
      diagnostic: {
        energyBaseline: null,
        focusPillar: null,
        frictionPoint: null,
        completedAt: null,
      },
      heroPlay: null,
      execution: {
        session: null,
        remainingSec: 0,
        timerRunning: false,
      },
      metrics: initialMetrics,
      setEnergyBaseline: (value) =>
        set((state) => ({
          diagnostic: {
            ...state.diagnostic,
            energyBaseline: value,
          },
        })),
      setFocusPillar: (value) =>
        set((state) => ({
          diagnostic: {
            ...state.diagnostic,
            focusPillar: value,
          },
        })),
      setFrictionPoint: (value) =>
        set((state) => ({
          diagnostic: {
            ...state.diagnostic,
            frictionPoint: value,
          },
        })),
      applyDiagnostic: (payload) =>
        set(() => ({
          diagnostic: {
            energyBaseline: payload.energyBaseline,
            focusPillar: payload.focusPillar,
            frictionPoint: payload.frictionPoint,
            completedAt: payload.completedAt,
          },
        })),
      setHeroPlay: (heroPlay) => set({ heroPlay }),
      setExecutionSession: (session) => {
        const firstActiveStep =
          session?.steps.find((step) => step.status === "active") ?? null;

        set({
          execution: {
            session,
            remainingSec: firstActiveStep?.durationSec ?? 0,
            timerRunning: Boolean(session && session.status === "in_progress"),
          },
        });
      },
      setRemainingSec: (seconds) =>
        set((state) => ({
          execution: {
            ...state.execution,
            remainingSec: Math.max(0, Math.floor(seconds)),
          },
        })),
      setTimerRunning: (running) =>
        set((state) => ({
          execution: {
            ...state.execution,
            timerRunning: running,
          },
        })),
      applyStepResult: (result) => {
        if (!result.session) {
          return;
        }

        const nextSession = result.session;
        const firstActiveStep =
          nextSession.steps.find((step) => step.status === "active") ?? null;

        set((state) => ({
          execution: {
            session: nextSession,
            remainingSec: firstActiveStep?.durationSec ?? 0,
            timerRunning: nextSession.status === "in_progress",
          },
          metrics:
            result.reward?.newTotals
              ? {
                  ...state.metrics,
                  xpTotal: result.reward.newTotals.xp,
                  level: result.reward.newTotals.level,
                  playsCompleted: result.reward.newTotals.playsCompleted,
                  decisionsSaved: result.reward.newTotals.decisionsSaved,
                  planningMinutesSaved: result.reward.newTotals.planningMinutesSaved,
                }
              : state.metrics,
        }));
      },
      syncMetrics: (metrics) =>
        set((state) => ({
          metrics: {
            ...state.metrics,
            ...metrics,
          },
        })),
      resetFlowExecution: () =>
        set({
          execution: {
            session: null,
            remainingSec: 0,
            timerRunning: false,
          },
        }),
    }),
    {
      name: FLOWSTATE_STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        diagnostic: state.diagnostic,
        execution: {
          session: state.execution.session,
          remainingSec: state.execution.remainingSec,
          timerRunning: false,
        },
      }),
    },
  ),
);
