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

export type TripBudget = "low" | "medium" | "high";

export type TripTransportMode =
  | "walk"
  | "public_transit"
  | "bike"
  | "car"
  | "mixed";

export type TripContextStatus = "active" | "completed" | "cancelled";

export type QuestExperienceTags = {
  familySafe: boolean;
  dateFriendly: boolean;
  kidFriendly: boolean;
  wheelchairAccessible: boolean;
  lowCrowd: boolean;
  indoorOption: boolean;
};

export type TripContext = {
  tripContextId: string;
  userId: string;
  cityId: CityId;
  contextType: TripContextType;
  groupSize: number;
  withKids: boolean;
  pace: TripPace;
  budget: TripBudget;
  transportMode: TripTransportMode;
  timeBudgetMin: number;
  startLocal?: string;
  vibeTags: string[];
  constraints: Record<string, unknown>;
  status: TripContextStatus;
  createdAt: string;
  updatedAt: string;
};

export type StartTripContextRequest = {
  cityId: CityId;
  contextType: TripContextType;
  groupSize?: number;
  withKids?: boolean;
  pace?: TripPace;
  budget?: TripBudget;
  transportMode?: TripTransportMode;
  timeBudgetMin?: number;
  startLocal?: string;
  vibeTags?: string[];
  constraints?: Record<string, unknown>;
};

export type StartTripContextResponse = {
  tripContextId: string;
  status: "active";
  cityId: CityId;
  contextType: TripContextType;
  createdAt: string;
};

export type UpdateTripContextRequest = Partial<{
  contextType: TripContextType;
  groupSize: number;
  withKids: boolean;
  pace: TripPace;
  budget: TripBudget;
  transportMode: TripTransportMode;
  timeBudgetMin: number;
  startLocal: string;
  vibeTags: string[];
  constraints: Record<string, unknown>;
}>;

export type UpdateTripContextResponse = TripContext;

export type EndTripContextRequest = {
  status?: "completed" | "cancelled";
};

export type EndTripContextResponse = {
  tripContextId: string;
  status: "completed" | "cancelled";
  endedAt: string;
};

export type RecommendedQuestItem = Quest & {
  tags: QuestExperienceTags;
  whyRecommended: string[];
  score: number;
};

export type RecommendedQuestsResponse = {
  tripContextId: string;
  cityId: CityId;
  quests: RecommendedQuestItem[];
};

export type RecommendationFeedbackType =
  | "shown"
  | "opened"
  | "started"
  | "completed"
  | "dismissed"
  | "saved";

export type RecommendationFeedbackRequest = {
  tripContextId?: string;
  questId: string;
  feedbackType: RecommendationFeedbackType;
  metadata?: Record<string, unknown>;
};

export type RecommendationFeedbackResponse = {
  status: "recorded";
  feedbackId?: string;
  createdAt?: string;
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
