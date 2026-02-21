export type QuestCardViewModel = {
  id: string;
  title: string;
  subtitle: string;
  xpReward: number;
  badgeLabel?: string;
  category: "landmark" | "food" | "culture" | "transit";
  status?: "nearby" | "suggested" | "completed";
};

export type FeedEventViewModel = {
  id: string;
  actorName: string;
  message: string;
  relativeTime: string;
  accent?: "cyan" | "green" | "purple";
};

export type ProfileSummaryViewModel = {
  userId: string;
  username: string;
  avatarUrl?: string;
  level: number;
  xpTotal: number;
  xpProgressLabel: string;
  streakDays: number;
  questsCompleted: number;
};

export type BadgeCabinetItemViewModel = {
  key: string;
  name: string;
  unlocked: boolean;
  unlockedAt?: string;
  iconUrl?: string;
};
