import type { QuestCardViewModel } from "./types";

type QuestCategory = QuestCardViewModel["category"];

export const HERO_BY_CATEGORY: Record<QuestCategory, string> = {
  landmark:
    "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=60",
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=60",
  culture:
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=60",
  transit:
    "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=60",
};
