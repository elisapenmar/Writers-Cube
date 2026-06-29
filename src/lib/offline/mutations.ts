/**
 * Offline-aware client wrappers for structural (project / chapter / scene)
 * mutations, plus the handler registry that replays them on reconnect.
 *
 * This is the seam between the UI and the server actions in `src/server/*.ts`:
 * instead of calling `renameScene(...)` directly, a mobile/offline caller calls
 * `renameSceneOffline(...)`, which queues the edit durably and (when online)
 * flushes immediately. The outbox replays via the same server action, so the
 * server-side CAS + conflict-preservation path is unchanged.
 *
 * SCOPE: only `scene.rename` is wired end to end (the representative path). The
 * other structural mutations (chapter rename, reorder, create/delete, tags,
 * loose scenes) are listed as follow-ups at the bottom; each is "add a handler +
 * a wrapper" against its existing server action.
 *
 * On native/standalone the wrappers always queue (offline-first). On desktop
 * web they pass straight through to the server action so behavior is unchanged
 * unless a caller opts in.
 */
"use client";

import { renameScene } from "@/server/scenes";
import { isNative, isStandalone } from "@/lib/platform";
import { enqueue, registerHandler, type OutboxEntry } from "./outbox";

/** Mutation kind ids (also the IndexedDB-stored handler keys). */
export const KIND_SCENE_RENAME = "scene.rename";

/** True when this runtime should route structural edits through the outbox. */
function offlineFirst(): boolean {
  return isNative() || isStandalone();
}

/**
 * Register every outbox replay handler. Call once from a client mount (the
 * editor does this). Idempotent: registerHandler overwrites a duplicate.
 */
export function registerOutboxHandlers(): void {
  registerHandler(KIND_SCENE_RENAME, async (entry: OutboxEntry) => {
    const title = String(entry.payload.title ?? "");
    // renameScene is the existing server action; replaying it re-runs the same
    // server-side write the online path would have run. (Follow-up: have rename
    // adopt casUpdate so entry.base drives conflict preservation like content.)
    await renameScene(entry.entityId, title);
  });
}

/**
 * Rename a scene, offline-capable. On an offline-first runtime the edit is
 * queued (and replays on reconnect); otherwise it calls the server action
 * directly so desktop web is unchanged. `base` is the scene's last-seen
 * `updated_at` (the CAS token), carried for conflict detection on replay.
 */
export async function renameSceneOffline(
  sceneId: string,
  title: string,
  base: string | null,
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_SCENE_RENAME, sceneId, { title }, base);
    return;
  }
  await renameScene(sceneId, title);
}

// FOLLOW-UPS (same pattern, one handler + one wrapper each):
// - chapter.rename   -> renameChapter
// - scene.reorder    -> reorderScenes
// - chapter.reorder  -> reorderChapters
// - project.meta     -> updateProjectMetadata
// - scene.create / chapter.create / *.delete
// - tag + loose-scene mutations
// Each needs an offline-stable client-generated id for create paths (so the
// optimistic row and its server row reconcile); rename/reorder/meta key on an
// existing id and need no extra plumbing beyond their server action.
