import { useCallback } from "react";
import * as Network from "expo-network";
import { completeQuest } from "../api/endpoints";
import { trackUiEvent } from "../analytics/events";
import {
  getDueOfflineEvents,
  getOfflineQueueSummary,
  markOfflineEventRetry,
  markOfflineEventSuccess,
} from "../db/offlineQueue";
import { useOfflineSyncState } from "../state/offlineSync";

export function useOfflineSync() {
  const flushQueue = useCallback(async () => {
    const setSyncing = useOfflineSyncState.getState().setSyncing;
    const setPendingCount = useOfflineSyncState.getState().setPendingCount;
    const setLastSyncAt = useOfflineSyncState.getState().setLastSyncAt;
    const setLastError = useOfflineSyncState.getState().setLastError;

    setSyncing(true);

    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected) {
        const summary = await getOfflineQueueSummary();
        setPendingCount(summary.pendingCount);
        setLastError("offline");
        return;
      }

      setLastError(null);
      const dueEvents = await getDueOfflineEvents(new Date().toISOString());
      trackUiEvent("offline_sync_flush", { dueEvents: dueEvents.length });

      for (const event of dueEvents) {
        try {
          if (event.type === "quest_completion") {
            const result = await completeQuest(event.payload);
            if (result.status === "accepted" || result.status === "duplicate") {
              await markOfflineEventSuccess(event.id);
              const ageMinutes = Math.max(
                0,
                (Date.now() - new Date(event.createdAt).getTime()) / 60000,
              );
              trackUiEvent("offline_sync_success", {
                status: result.status,
                ageMinutes: Number(ageMinutes.toFixed(2)),
              });
              continue;
            }
            await markOfflineEventRetry(event.id, event.retryCount + 1);
            trackUiEvent("offline_sync_retry", {
              reason: result.reason ?? "unknown",
              retryCount: event.retryCount + 1,
            });
          }
        } catch {
          await markOfflineEventRetry(event.id, event.retryCount + 1);
          trackUiEvent("offline_sync_retry", {
            reason: "network_or_server_error",
            retryCount: event.retryCount + 1,
          });
        }
      }

      const summary = await getOfflineQueueSummary();
      setPendingCount(summary.pendingCount);
      setLastSyncAt(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  }, []);

  return { flushQueue };
}
