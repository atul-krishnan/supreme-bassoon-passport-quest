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
};

export type FriendRequestPayload = {
  receiverUserId: string;
};

export type FriendAcceptPayload = {
  requestId: string;
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
