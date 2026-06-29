/**
 * Shared sync-state store + React hook. This is the small, reusable surface
 * Agent B renders (an indicator in the mobile shell/nav). It is a framework-free
 * observable store with a `useSyncState()` hook on top, so non-React callers
 * (the outbox) can publish and React callers can subscribe.
 *
 * The status is derived, not stored: callers report the raw facts (online,
 * pending count, whether a flush is in progress) and `deriveStatus` maps them to
 * the three states the UI cares about.
 */
"use client";

import { useSyncExternalStore } from "react";

/** The three states a writer needs to trust the app. */
export type SyncStatus = "synced" | "pending" | "offline";

export type SyncState = {
  /** Network reachable (best-effort; see online-state.ts). */
  online: boolean;
  /** Not-yet-confirmed structural mutations in the outbox. */
  pending: number;
  /** A flush pass is currently replaying queued mutations. */
  syncing: boolean;
  /** Derived label for the UI. */
  status: SyncStatus;
};

function deriveStatus(s: { online: boolean; pending: number }): SyncStatus {
  if (!s.online) return "offline";
  if (s.pending > 0) return "pending";
  return "synced";
}

let state: SyncState = {
  online: true,
  pending: 0,
  syncing: false,
  status: "synced",
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Merge a partial update into the sync state (called by the outbox / online
 * detector). Recomputes the derived status and notifies subscribers only when
 * something actually changed, so the indicator does not re-render needlessly.
 */
export function notifySyncState(patch: Partial<Omit<SyncState, "status">>): void {
  const next: SyncState = {
    online: patch.online ?? state.online,
    pending: patch.pending ?? state.pending,
    syncing: patch.syncing ?? state.syncing,
    status: "synced",
  };
  next.status = deriveStatus(next);
  const changed =
    next.online !== state.online ||
    next.pending !== state.pending ||
    next.syncing !== state.syncing ||
    next.status !== state.status;
  if (!changed) return;
  state = next;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SyncState {
  return state;
}

// The server has no network/queue concept; render the optimistic "synced" so
// the indicator does not flash a wrong state during hydration.
const SERVER_STATE: SyncState = {
  online: true,
  pending: 0,
  syncing: false,
  status: "synced",
};
function getServerSnapshot(): SyncState {
  return SERVER_STATE;
}

/**
 * Subscribe to sync state from a React component. This is the hook Agent B's
 * indicator consumes:
 *
 *   const { status, pending, syncing } = useSyncState();
 */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Imperative read for non-React callers / tests. */
export function getSyncState(): SyncState {
  return state;
}
