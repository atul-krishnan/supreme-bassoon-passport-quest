export type CityId = "blr" | "nyc";

export type BootstrapConfig = {
  cityId: CityId;
  timeZone: string;
  quietHours: {
    startLocal: string;
    endLocal: string;
  };
  antiCheat: {
    maxAccuracyM: number;
    maxSpeedMps: number;
    maxAttemptsPerMinute: number;
  };
  featureFlags: Record<string, boolean>;
  experiments?: Record<string, "control" | "treatment">;
  notificationPolicy?: {
    quietHours: {
      startLocal: string;
      endLocal: string;
    };
    timeZone: string;
    pushEnabled: boolean;
    suppressNow: boolean;
  };
};

export type EnergyBaseline = "low" | "balanced" | "high";
export type FocusPillar = "deep_work" | "vitality_health" | "local_discovery";
export type FrictionPoint = "decision_paralysis" | "procrastination";

export type FlowDiagnosticRequest = {
  energyBaseline: EnergyBaseline;
  focusPillar: FocusPillar;
  frictionPoint: FrictionPoint;
};

export type FlowDiagnosticResponse = {
  status: "saved";
  completedAt: string;
  energyBaseline: EnergyBaseline;
  focusPillar: FocusPillar;
  frictionPoint: FrictionPoint;
};

export type PlayStepStatus = "pending" | "active" | "completed";
export type PlaySessionStatus = "in_progress" | "paused" | "completed" | "cancelled";

export type HeroPlayStep = {
  order: number;
  title: string;
  instruction: string;
  durationSec: number;
};

export type HeroPlay = {
  recommendationId: string;
  playId: string;
  title: string;
  summary: string;
  focusPillar: FocusPillar;
  durationMin: number;
  xpReward: number;
  decisionMinutesSaved: number;
  why: string;
  steps: HeroPlayStep[];
  expiresAt: string;
};

export type HeroPlayResponse = {
  status: "ready" | "diagnostic_required";
  heroPlay?: HeroPlay;
  diagnosticCompletedAt?: string;
};

export type PlaySessionStep = {
  order: number;
  title: string;
  instruction: string;
  durationSec: number;
  status: PlayStepStatus;
  startedAt?: string;
  completedAt?: string;
};

export type PlaySession = {
  sessionId: string;
  playId: string;
  recommendationId?: string;
  title: string;
  focusPillar: FocusPillar;
  status: PlaySessionStatus;
  currentStepOrder: number | null;
  startedAt: string;
  completedAt?: string;
  xpReward: number;
  decisionMinutesSaved: number;
  why: string;
  steps: PlaySessionStep[];
};

export type StartPlaySessionRequest = {
  recommendationId: string;
};

export type StartPlaySessionResponse = {
  status: "started" | "recommendation_not_found";
  session?: PlaySession;
};

export type PlaySessionResponse = {
  status: "ok" | "not_found";
  session?: PlaySession;
};

export type MarkPlayStepDoneResponse = {
  status: "progressed" | "completed" | "already_completed" | "not_found";
  session?: PlaySession;
  reward?: {
    xpAwarded: number;
    newTotals: {
      xp: number;
      level: number;
      playsCompleted: number;
      decisionsSaved: number;
      planningMinutesSaved: number;
    };
  };
};

export type FlowStateSummaryResponse = {
  stats: {
    xpTotal: number;
    level: number;
    playsCompleted: number;
    decisionsSaved: number;
    planningMinutesSaved: number;
  };
  diagnosticCompletedAt?: string;
  activeSession?: PlaySession;
};

export type UserSummaryResponse = {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
    homeCityId?: CityId;
    flowDiagnosticCompletedAt?: string;
  };
  stats: {
    xpTotal: number;
    level: number;
    streakDays: number;
    playsCompleted: number;
    decisionsSaved: number;
    planningMinutesSaved: number;
  };
};

export type UpdateProfileRequest = {
  username?: string;
  avatarUrl?: string | null;
  homeCityId?: CityId;
};

export type RegisterPushTokenRequest = {
  pushToken: string;
  platform: "ios" | "android";
  appVersion?: string;
};

export type RegisterPushTokenResponse = {
  status: "registered";
  token: string;
  platform: "ios" | "android";
  updatedAt: string;
};

export type HealthResponse = {
  status: "ok";
  environment: string;
  releaseSha: string;
  serverTime: string;
};
