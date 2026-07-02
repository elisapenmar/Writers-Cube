/**
 * Public surface of the offline/sync layer. Agent B and other consumers should
 * import from here rather than reaching into individual files.
 *
 * - useSyncState(): the React hook for the synced / pending / offline indicator.
 * - SyncStatus / SyncState: the indicator's types.
 * - startOutbox(): wire the queue to connectivity (call once from a client mount).
 * - *Offline(): offline-capable mutation wrappers (renames, reorders, meta, delete).
 * - registerOutboxHandlers(): register replay handlers (editor + mobile shell).
 */
export { useSyncState, getSyncState, type SyncState, type SyncStatus } from "./sync-state";
export { startOutbox, flush, pendingCount, enqueue, registerHandler } from "./outbox";
export type { OutboxEntry, OutboxHandler } from "./outbox";
export { isOnline, onOnlineChange } from "./online-state";
export {
  renameSceneOffline,
  renameChapterOffline,
  renameLooseSceneOffline,
  deleteLooseSceneOffline,
  updateProjectMetadataOffline,
  reorderScenesOffline,
  reorderChaptersOffline,
  registerOutboxHandlers,
} from "./mutations";
