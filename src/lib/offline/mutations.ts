/**
 * Offline-aware client wrappers for structural (project / chapter / scene)
 * mutations, plus the handler registry that replays them on reconnect.
 *
 * This is the seam between the UI and the server actions in `src/server/*.ts`:
 * instead of calling `renameScene(...)` directly, a caller uses
 * `renameSceneOffline(...)`, which queues the edit durably and (when online)
 * flushes immediately. The outbox replays via the same server action, so the
 * server-side CAS + conflict-preservation path is unchanged.
 *
 * Wired mutations: scene/chapter/loose/project renames + metadata, scene and
 * chapter reorders, loose-scene delete. Create paths (scene/chapter/loose) stay
 * online-only for now: their server actions redirect into the new row, and an
 * offline create needs a client-generated id plus optimistic UI to be useful —
 * that is a separate, larger follow-up.
 *
 * On native/standalone the wrappers always queue (offline-first). On desktop
 * web they pass straight through to the server action so behavior is unchanged.
 */
"use client";

import {
  renameScene,
  renameChapter,
  reorderScenes,
  reorderChapters,
  updateProjectMetadata,
} from "@/server/scenes";
import { renameLooseScene, deleteLooseScene } from "@/server/loose";
import { isNative, isStandalone } from "@/lib/platform";
import { enqueue, registerHandler, type OutboxEntry } from "./outbox";

/** Mutation kind ids (also the IndexedDB-stored handler keys). */
export const KIND_SCENE_RENAME = "scene.rename";
export const KIND_CHAPTER_RENAME = "chapter.rename";
export const KIND_LOOSE_RENAME = "loose.rename";
export const KIND_LOOSE_DELETE = "loose.delete";
export const KIND_PROJECT_META = "project.meta";
export const KIND_SCENE_REORDER = "scene.reorder";
export const KIND_CHAPTER_REORDER = "chapter.reorder";

/** True when this runtime should route structural edits through the outbox. */
function offlineFirst(): boolean {
  return isNative() || isStandalone();
}

type ProjectMetadata = Parameters<typeof updateProjectMetadata>[1];

/**
 * Register every outbox replay handler. Call once from a client mount (the
 * editor and the mobile shell both do). Idempotent: registerHandler overwrites
 * a duplicate. Replaying re-runs the same server action the online path would
 * have run, so CAS conflict handling stays server-side. (Follow-up: have the
 * rename actions adopt casUpdate so entry.base drives conflict preservation the
 * way it already does for scene content.)
 */
export function registerOutboxHandlers(): void {
  registerHandler(KIND_SCENE_RENAME, async (entry: OutboxEntry) => {
    await renameScene(entry.entityId, String(entry.payload.title ?? ""));
  });
  registerHandler(KIND_CHAPTER_RENAME, async (entry: OutboxEntry) => {
    await renameChapter(entry.entityId, String(entry.payload.title ?? ""));
  });
  registerHandler(KIND_LOOSE_RENAME, async (entry: OutboxEntry) => {
    await renameLooseScene(entry.entityId, String(entry.payload.title ?? ""));
  });
  registerHandler(KIND_LOOSE_DELETE, async (entry: OutboxEntry) => {
    await deleteLooseScene(entry.entityId);
  });
  registerHandler(KIND_PROJECT_META, async (entry: OutboxEntry) => {
    await updateProjectMetadata(entry.entityId, entry.payload.meta as ProjectMetadata);
  });
  registerHandler(KIND_SCENE_REORDER, async (entry: OutboxEntry) => {
    await reorderScenes(entry.entityId, (entry.payload.orderedIds as string[]) ?? []);
  });
  registerHandler(KIND_CHAPTER_REORDER, async (entry: OutboxEntry) => {
    await reorderChapters(entry.entityId, (entry.payload.orderedIds as string[]) ?? []);
  });
}

/**
 * Rename a scene, offline-capable. On an offline-first runtime the edit is
 * queued (and replays on reconnect); otherwise it calls the server action
 * directly so desktop web is unchanged. `base` is the row's last-seen
 * `updated_at` (the CAS token) when the caller has it; null is fine.
 */
export async function renameSceneOffline(
  sceneId: string,
  title: string,
  base: string | null = null,
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_SCENE_RENAME, sceneId, { title }, base);
    return;
  }
  await renameScene(sceneId, title);
}

export async function renameChapterOffline(
  chapterId: string,
  title: string,
  base: string | null = null,
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_CHAPTER_RENAME, chapterId, { title }, base);
    return;
  }
  await renameChapter(chapterId, title);
}

export async function renameLooseSceneOffline(
  id: string,
  title: string,
  base: string | null = null,
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_LOOSE_RENAME, id, { title }, base);
    return;
  }
  await renameLooseScene(id, title);
}

/**
 * Delete a loose scene, offline-capable. The caller navigates away optimistically;
 * the row is removed on replay when connectivity returns.
 */
export async function deleteLooseSceneOffline(id: string): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_LOOSE_DELETE, id, {}, null);
    return;
  }
  await deleteLooseScene(id);
}

export async function updateProjectMetadataOffline(
  projectId: string,
  meta: ProjectMetadata,
  base: string | null = null,
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_PROJECT_META, projectId, { meta }, base);
    return;
  }
  await updateProjectMetadata(projectId, meta);
}

/**
 * Reorders queue the full ordered-id list; replaying the latest queued order
 * last (FIFO) converges on what the writer last saw locally.
 */
export async function reorderScenesOffline(
  chapterId: string,
  orderedIds: string[],
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_SCENE_REORDER, chapterId, { orderedIds }, null);
    return;
  }
  await reorderScenes(chapterId, orderedIds);
}

export async function reorderChaptersOffline(
  projectId: string,
  orderedIds: string[],
): Promise<void> {
  if (offlineFirst()) {
    await enqueue(KIND_CHAPTER_REORDER, projectId, { orderedIds }, null);
    return;
  }
  await reorderChapters(projectId, orderedIds);
}

// FOLLOW-UPS:
// - scene.create / chapter.create / loose.create: need an offline-stable
//   client-generated id + optimistic UI so the new row exists locally before the
//   server assigns it; their server actions currently redirect into the row.
// - tags + attach/split/merge flows (lower traffic, same handler pattern).
