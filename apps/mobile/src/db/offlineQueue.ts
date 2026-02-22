import * as SQLite from "expo-sqlite";
import type { CompleteQuestRequest } from "@passport-quest/shared";

const dbPromise = SQLite.openDatabaseAsync("passport_quest.db");

export type OfflineEventRow = {
  id: number;
  type: "quest_completion";
  payload: CompleteQuestRequest;
  createdAt: string;
  retryCount: number;
  nextRetryAt: string;
};

export type OfflineQueueSummary = {
  pendingCount: number;
  oldestPendingAt?: string;
};

async function getDb() {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT NOT NULL
    );
  `);
  return db;
}

export async function enqueueQuestCompletion(payload: CompleteQuestRequest) {
  const db = await getDb();
  await db.runAsync(
    `
    INSERT INTO offline_events (event_type, payload_json, created_at, retry_count, next_retry_at)
    VALUES (?, ?, ?, 0, ?)
    `,
    "quest_completion",
    JSON.stringify(payload),
    new Date().toISOString(),
    new Date().toISOString()
  );
}

export async function getDueOfflineEvents(nowIso: string): Promise<OfflineEventRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    event_type: string;
    payload_json: string;
    created_at: string;
    retry_count: number;
    next_retry_at: string;
  }>(
    `
    SELECT id, event_type, payload_json, created_at, retry_count, next_retry_at
    FROM offline_events
    WHERE next_retry_at <= ?
    ORDER BY id ASC
    LIMIT 20
    `,
    nowIso
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.event_type as "quest_completion",
    payload: JSON.parse(row.payload_json) as CompleteQuestRequest,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at
  }));
}

export async function markOfflineEventSuccess(id: number) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM offline_events WHERE id = ?`, id);
}

export async function markOfflineEventRetry(id: number, retryCount: number) {
  const db = await getDb();
  const backoffSeconds = Math.min(300, Math.pow(2, retryCount));
  const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
  await db.runAsync(
    `
    UPDATE offline_events
    SET retry_count = ?, next_retry_at = ?
    WHERE id = ?
    `,
    retryCount,
    nextRetryAt,
    id
  );
}

export async function getOfflineQueueSummary(): Promise<OfflineQueueSummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    pending_count: number;
    oldest_pending_at: string | null;
  }>(`
    SELECT
      COUNT(*) as pending_count,
      MIN(created_at) as oldest_pending_at
    FROM offline_events
  `);

  return {
    pendingCount: row?.pending_count ?? 0,
    oldestPendingAt: row?.oldest_pending_at ?? undefined,
  };
}

export async function clearOfflineQueue() {
  const db = await getDb();
  await db.runAsync(`DELETE FROM offline_events`);
}
