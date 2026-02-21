import { create } from "zustand";

type OfflineSyncState = {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
  setLastSyncAt: (lastSyncAt: string | null) => void;
  setLastError: (lastError: string | null) => void;
};

export const useOfflineSyncState = create<OfflineSyncState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setLastError: (lastError) => set({ lastError }),
}));
