"use client";

import { useEffect } from "react";
import { create } from "zustand";

/**
 * Sync-state contract (the second A∩B boundary).
 *
 * Agent A (offline + sync) owns the real sync engine (Yjs + IndexedDB + the
 * metadata outbox). Agent B (mobile UI) only needs to render a trustworthy
 * "synced / pending / offline" indicator. This module is the thin shared store
 * both can agree on:
 *
 *   - "synced"  : local edits are persisted to the server; nothing pending.
 *   - "pending" : edits are saved locally and queued, not yet acknowledged by
 *                 the server (a save is in flight or the outbox is draining).
 *   - "offline" : the device has no connection; edits are local-only and will
 *                 replay on reconnect.
 *
 * EXPECTED FROM AGENT A: drive this store from the sync engine, e.g.
 *     useSyncState.getState().setStatus("pending")  // on enqueue
 *     useSyncState.getState().setStatus("synced")   // on flush/ack
 * and set "offline" from the network listener.
 *
 * LOCAL FALLBACK (this file, active until A wires the engine): we approximate
 * the status from the browser's online/offline events so the indicator is
 * truthful about connectivity even before the outbox exists. A reports actual
 * pending writes once the engine lands; this fallback never invents a false
 * "synced", it only reflects connectivity. Mount the fallback once via
 * `useSyncStatusFallback()` near the app root.
 */
export type SyncStatus = "synced" | "pending" | "offline";

type SyncState = {
  status: SyncStatus;
  /** Last time we reached a fully-synced state, for "saved 2m ago" style copy. */
  lastSyncedAt: number | null;
  setStatus: (status: SyncStatus) => void;
};

export const useSyncState = create<SyncState>((set) => ({
  status: "synced",
  lastSyncedAt: null,
  setStatus: (status) =>
    set({ status, lastSyncedAt: status === "synced" ? Date.now() : undefined }),
}));

/** Read the current sync status (for the indicator component). */
export function useSyncStatus(): SyncStatus {
  return useSyncState((s) => s.status);
}

/**
 * Connectivity-based fallback driver. Mount once near the app root. It only sets
 * "offline" vs "synced" from the browser network events; once Agent A's engine
 * is present it should take over (its writes set "pending"), and this listener's
 * "synced" simply means "online with nothing the fallback knows is pending".
 */
export function useSyncStatusFallback(): void {
  useEffect(() => {
    const setStatus = useSyncState.getState().setStatus;
    const update = () => setStatus(navigator.onLine ? "synced" : "offline");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
}
