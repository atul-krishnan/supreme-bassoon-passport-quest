export type CityId = "blr" | "nyc" | "del" | "pnq";

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

export type UserSummaryResponse = {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
    homeCityId?: CityId;
  };
  stats: {
    xpTotal: number;
    level: number;
    streakDays: number;
    questsCompleted: number;
    badgeCount: number;
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
  releaseGates?: {
    nearbyApiP95Ms: number | null;
    nearbyApiSampleCount: number;
    nearbyApiTargetMs: number;
    nearbyApiGatePassed: boolean;
  };
};
