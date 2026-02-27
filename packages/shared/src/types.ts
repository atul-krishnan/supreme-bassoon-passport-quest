export type CityId = "blr" | "nyc";

export type QuestCategory = "landmark" | "food" | "culture" | "transit";

export type GeoFence = {
  lat: number;
  lng: number;
  radiusM: number;
};

export type Quest = {
  id: string;
  cityId: CityId;
  title: string;
  description: string;
  category: QuestCategory;
  geofence: GeoFence;
  xpReward: number;
  badgeKey?: string;
  activeFrom: string;
  activeTo?: string;
};

export type CompleteQuestRequest = {
  questId: string;
  occurredAt: string;
  location: {
    lat: number;
    lng: number;
    accuracyM: number;
    speedMps?: number;
  };
  deviceEventId: string;
};

export type CompleteQuestResponse = {
  status: "accepted" | "rejected" | "duplicate";
  reason?: string;
  awardedXp?: number;
  badgeUnlocked?: {
    key: string;
    name: string;
  };
  newTotals?: {
    xp: number;
    level: number;
    streakDays: number;
  };
};

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

export type TripContextType = "solo" | "couple" | "family" | "friends";
export type TripPace = "relaxed" | "balanced" | "active";
export type PlanBudgetBand = "low" | "medium" | "high";

export type TripContextStartRequest = {
  cityId: CityId;
  contextType: TripContextType;
  timeBudgetMin: number;
  budget: PlanBudgetBand;
  pace: TripPace;
  vibeTags?: string[];
  constraints?: Record<string, unknown>;
};

export type TripContextUpdateRequest = {
  contextType?: TripContextType;
  timeBudgetMin?: number;
  budget?: PlanBudgetBand;
  pace?: TripPace;
  vibeTags?: string[];
  constraints?: Record<string, unknown>;
};

export type TripContextResponse = {
  tripContextId: string;
  status: "active" | "completed" | "cancelled" | "not_found";
  cityId?: CityId;
  contextType?: TripContextType;
  createdAt?: string;
  updatedAt?: string;
};

export type PlanStop = {
  questId: string;
  title: string;
  order: number;
  visitDurationMin: number;
  storySnippet: string;
  practicalDetails: string[];
  heroImageUrl?: string;
  reason_string?: string;
};

export type PlanBundle = {
  planId: string;
  title: string;
  summary: string;
  estimatedDurationMin: number;
  estimatedSpendBand: PlanBudgetBand;
  whyRecommended: string[];
  reason_string?: string;
  trust_signal?: string;
  stops: PlanStop[];
};

export type RecommendedPlansResponse = {
  tripContextId: string;
  cityId: CityId;
  plans: PlanBundle[];
};

export type RecommendationFeedbackRequest = {
  tripContextId: string;
  planId: string;
  questId?: string;
  feedbackType: "shown" | "opened" | "started" | "completed" | "dismissed" | "saved";
  metadata?: Record<string, unknown>;
};

export type RecommendationFeedbackResponse = {
  status: "recorded";
  feedbackId: string;
};

export type SavePlanRequest = {
  planId: string;
  tripContextId: string;
  cityId: CityId;
  planPayload: PlanBundle;
};

export type SavePlanResponse = {
  status: "saved";
  planId: string;
  updatedAt: string;
};

export type SavedPlanItem = {
  planId: string;
  tripContextId?: string;
  cityId: CityId;
  planPayload: PlanBundle;
  savedAt: string;
  updatedAt: string;
};

export type SavedPlansResponse = {
  items: SavedPlanItem[];
  nextCursor?: string;
};

export type DeleteSavedPlanResponse = {
  status: "deleted" | "not_found";
  planId: string;
};

export type FriendRequestPayload = {
  receiverUserId: string;
};

export type FriendRequestByUsernamePayload = {
  username: string;
};

export type FriendAcceptPayload = {
  requestId: string;
};

export type IncomingFriendRequest = {
  requestId: string;
  senderUserId: string;
  senderUsername: string;
  senderAvatarUrl?: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export type IncomingFriendRequestsResponse = {
  requests: IncomingFriendRequest[];
};

export type NearbyQuestResponse = {
  cityId: CityId;
  generatedAt: string;
  quests: Quest[];
};

export type SocialFeedEvent = {
  id: string;
  userId: string;
  eventType:
    | "quest_completed"
    | "badge_unlocked"
    | "streak_updated"
    | "friend_connected";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SocialFeedResponse = {
  events: SocialFeedEvent[];
  nextCursor?: string;
};

export type ProfileCompareResponse = {
  me: {
    userId: string;
    xp: number;
    level: number;
    streakDays: number;
    badgeCount: number;
  };
  friend: {
    userId: string;
    xp: number;
    level: number;
    streakDays: number;
    badgeCount: number;
  };
  deltas: {
    xp: number;
    level: number;
    streakDays: number;
    badgeCount: number;
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
    questsCompleted: number;
    badgeCount: number;
    playsCompleted: number;
    decisionsSaved: number;
    planningMinutesSaved: number;
  };
};

export type UserBadgeItem = {
  key: string;
  name: string;
  description: string;
  iconUrl?: string;
  unlocked: boolean;
  unlockedAt?: string;
};

export type UserBadgesResponse = {
  badges: UserBadgeItem[];
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
