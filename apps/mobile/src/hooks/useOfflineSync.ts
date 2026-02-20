import { useCallback } from "react";
import * as Network from "expo-network";
import { completeQuest } from "../api/endpoints";
import {
  getDueOfflineEvents,
  markOfflineEventRetry,
  markOfflineEventSuccess
} from "../db/offlineQueue";

export function useOfflineSync() {
  const flushQueue = useCallback(async () => {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      return;
    }

    const dueEvents = await getDueOfflineEvents(new Date().toISOString());
    for (const event of dueEvents) {
      try {
        if (event.type === "quest_completion") {
          const result = await completeQuest(event.payload);
          if (result.status === "accepted" || result.status === "duplicate") {
            await markOfflineEventSuccess(event.id);
            continue;
          }
          await markOfflineEventRetry(event.id, event.retryCount + 1);
        }
      } catch {
        await markOfflineEventRetry(event.id, event.retryCount + 1);
      }
    }
  }, []);

  return { flushQueue };
}
