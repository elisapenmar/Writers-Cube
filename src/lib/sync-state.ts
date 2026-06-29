"use client";

/**
 * Sync-state adapter (the A∩B boundary).
 *
 * Agent A owns the real sync engine and its store at `@/lib/offline/sync-state`,
 * which the metadata outbox drives with actual pending counts. Agent B's mobile
 * chrome was built against this thin surface (`useSyncStatus` + a connectivity
 * fallback), so rather than keep two competing stores this file now re-exports
 * A's store and adds the app-wide connectivity feed.
 *
 *   - "synced"  : online, nothing pending.
 *   - "pending" : online, the outbox has unacknowledged mutations.
 *   - "offline" : no connection; edits are local-only and replay on reconnect.
 */
import { useEffect } from "react";
import { useSyncState, notifySyncState, type SyncStatus } from "@/lib/offline/sync-state";
import { isOnline, onOnlineChange } from "@/lib/offline/online-state";

export type { SyncStatus };

/** Read the current sync status (for the indicator component). */
export function useSyncStatus(): SyncStatus {
  return useSyncState().status;
}

/**
 * App-wide connectivity feed. Mount once near the app root (the mobile shell).
 * The outbox also reports connectivity once an editor boots it, but mounting
 * this keeps online/offline truthful everywhere (e.g. on browsing screens where
 * no editor is mounted). `notifySyncState` only emits on real change, so the two
 * sources are idempotent.
 */
export function useSyncStatusFallback(): void {
  useEffect(() => {
    notifySyncState({ online: isOnline() });
    return onOnlineChange((online) => notifySyncState({ online }));
  }, []);
}
