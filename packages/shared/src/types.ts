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
