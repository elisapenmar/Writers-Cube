/**
 * Offline mutation outbox for project structure / metadata (scenes, chapters,
 * projects, tags, loose scenes). Document *body* offline is handled separately
 * by y-indexeddb on the CRDT path; this is the net-new half for the structural
 * rows that mutate through `src/server/*.ts` with CAS conflict detection.
 *
 * Model: every structural edit becomes a durable entry in an IndexedDB queue
 * (the "outbox"). When online, entries replay in FIFO order against their
 * server action. Each entry carries the CAS version token (the `updated_at` the
 * client last saw) so the server can detect a concurrent write and preserve the
 * value being overwritten — exactly the last-writer-wins-with-preservation
 * semantics `src/server/cas.ts` already implements for the rows.
 *
 * A handler registry keeps this generic: each mutation kind registers one
 * replay function, so wiring the remaining mutation paths later is "add a kind
 * + a handler", not a rewrite. Only `scene.rename` is wired end to end here as
 * the representative path (see registerOutboxHandlers); the rest are follow-ups.
 */
import { idbPut, idbGetAll, idbDelete, OUTBOX_STORE } from "./idb";
import { isOnline, onOnlineChange } from "./online-state";
import { notifySyncState } from "./sync-state";

/** A single queued structural mutation, durable across reloads. */
export type OutboxEntry = {
  /** Stable client-generated id (also the IndexedDB key). */
  id: string;
  /** Which registered handler replays this (e.g. "scene.rename"). */
  kind: string;
  /** The row this targets, used for conflict bookkeeping / dedup. */
  entityId: string;
  /** Handler-specific arguments (must be structured-clone-able for IndexedDB). */
  payload: Record<string, unknown>;
  /**
   * The CAS version token (the row's `updated_at`) the client last saw, so the
   * server replay can detect a concurrent change. Null when unknown.
   */
  base: string | null;
  /** When the edit was made locally (for FIFO ordering + UI). */
  createdAt: number;
  /** Replay attempts so far (for backoff / surfacing a stuck entry). */
  attempts: number;
};

/**
 * Replays one entry against the server. Throw to signal a retryable failure
 * (kept in the queue); return normally on success (removed from the queue).
 * Resolving the CAS conflict is the server action's job (it already does, via
 * casUpdate); the handler just forwards `entry.base` as the version token.
 */
export type OutboxHandler = (entry: OutboxEntry) => Promise<void>;

const handlers = new Map<string, OutboxHandler>();

/** Register the replay function for a mutation kind. Idempotent. */
export function registerHandler(kind: string, handler: OutboxHandler): void {
  handlers.set(kind, handler);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let flushing = false;
let flushQueuedAgain = false;

/**
 * Enqueue a structural mutation. If online, kicks an immediate flush so the
 * normal (connected) case round-trips right away; offline, it simply persists
 * and waits for reconnect. Returns the created entry id.
 */
export async function enqueue(
  kind: string,
  entityId: string,
  payload: Record<string, unknown>,
  base: string | null,
): Promise<string> {
  const entry: OutboxEntry = {
    id: newId(),
    kind,
    entityId,
    payload,
    base,
    createdAt: Date.now(),
    attempts: 0,
  };
  await idbPut(OUTBOX_STORE, entry);
  await publishState();
  if (isOnline()) void flush();
  return entry.id;
}

/** Current count of not-yet-confirmed mutations. */
export async function pendingCount(): Promise<number> {
  const all = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return all.length;
}

async function publishState(): Promise<void> {
  const pending = await pendingCount();
  notifySyncState({
    online: isOnline(),
    pending,
    // "syncing" is owned by the flush loop; here we only report the queue depth.
  });
}

/**
 * Replay queued mutations in FIFO order. Safe to call repeatedly; concurrent
 * calls collapse into one pass (with a single re-run if work arrived mid-flush).
 * Stops early when offline. Entries that throw stay queued for the next attempt.
 */
export async function flush(): Promise<void> {
  if (flushing) {
    flushQueuedAgain = true;
    return;
  }
  if (!isOnline()) {
    await publishState();
    return;
  }
  flushing = true;
  try {
    notifySyncState({ online: true, syncing: true });
    let entries = (await idbGetAll<OutboxEntry>(OUTBOX_STORE)).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    for (const entry of entries) {
      if (!isOnline()) break;
      const handler = handlers.get(entry.kind);
      if (!handler) {
        // No registered replay for this kind (a follow-up mutation path that has
        // not been wired yet). Leave it queued rather than dropping the edit.
        continue;
      }
      try {
        await handler(entry);
        await idbDelete(OUTBOX_STORE, entry.id);
      } catch {
        // Retryable failure (offline mid-flush, transient server error). Bump
        // the attempt counter and leave it queued for the next flush.
        await idbPut(OUTBOX_STORE, { ...entry, attempts: entry.attempts + 1 });
      }
    }
    entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
    notifySyncState({
      online: isOnline(),
      syncing: false,
      pending: entries.length,
    });
  } finally {
    flushing = false;
    if (flushQueuedAgain) {
      flushQueuedAgain = false;
      void flush();
    }
  }
}

let started = false;

/**
 * Wire the outbox to connectivity: flush on reconnect and on startup. Call once
 * from a client mount (idempotent). Returns an unsubscribe for cleanup.
 */
export function startOutbox(): () => void {
  if (started) return () => {};
  started = true;
  const off = onOnlineChange((online) => {
    void publishState();
    if (online) void flush();
  });
  // Attempt an initial drain in case edits were queued in a previous session.
  void flush();
  return () => {
    started = false;
    off();
  };
}
