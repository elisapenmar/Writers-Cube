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
  createChapter,
  createScene,
  createChapterWithId,
  createSceneWithId,
} from "@/server/scenes";
import {
  renameLooseScene,
  deleteLooseScene,
  createLooseScene,
  createLooseSceneWithId,
} from "@/server/loose";
import { isNative, isStandalone, isMobile } from "@/lib/platform";
import { isOnline } from "./online-state";
import { idbGetAll, OUTBOX_STORE } from "./idb";
import { enqueue, registerHandler, type OutboxEntry } from "./outbox";

/** Mutation kind ids (also the IndexedDB-stored handler keys). */
export const KIND_SCENE_RENAME = "scene.rename";
export const KIND_CHAPTER_RENAME = "chapter.rename";
export const KIND_LOOSE_RENAME = "loose.rename";
export const KIND_LOOSE_DELETE = "loose.delete";
export const KIND_PROJECT_META = "project.meta";
export const KIND_SCENE_REORDER = "scene.reorder";
export const KIND_CHAPTER_REORDER = "chapter.reorder";
export const KIND_CHAPTER_CREATE = "chapter.create";
export const KIND_SCENE_CREATE = "scene.create";
export const KIND_LOOSE_CREATE = "loose.create";

/**
 * True when this runtime should route structural edits through the outbox:
 * the native shell, an installed PWA, or any phone-width browser tab. A writer
 * in mobile Safari expects offline to work the same as the installed app;
 * desktop web (wide viewport) keeps calling server actions directly.
 */
function offlineFirst(): boolean {
  return isNative() || isStandalone() || isMobile();
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
  // Creates replay through the *WithId variants: entityId is the row id the
  // client generated offline, so retries are idempotent (duplicate key = done).
  registerHandler(KIND_CHAPTER_CREATE, async (entry: OutboxEntry) => {
    await createChapterWithId(String(entry.payload.projectId), entry.entityId);
  });
  registerHandler(KIND_SCENE_CREATE, async (entry: OutboxEntry) => {
    await createSceneWithId(String(entry.payload.chapterId), entry.entityId);
  });
  registerHandler(KIND_LOOSE_CREATE, async (entry: OutboxEntry) => {
    await createLooseSceneWithId(String(entry.payload.projectId), entry.entityId);
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

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback uuid-v4 shape for very old webviews; the DB only needs a valid uuid.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Result of an offline-capable create: `queued` means the row does not exist
 *  on the server yet; `id` is the row's id either way (server's or generated). */
export type CreateResult = { queued: boolean; id: string | null };

/**
 * Creates differ from renames: when online (any runtime) they call the original
 * server action so today's UX is untouched (immediate row, navigation/redirect
 * for loose scenes). Only when actually offline do they queue, with a
 * client-generated uuid so the pending row and the eventual server row match.
 */
export async function createChapterOffline(projectId: string): Promise<CreateResult> {
  if (!isOnline()) {
    const id = newRowId();
    await enqueue(KIND_CHAPTER_CREATE, id, { projectId }, null);
    return { queued: true, id };
  }
  const id = await createChapter(projectId);
  return { queued: false, id: id ?? null };
}

export async function createSceneOffline(chapterId: string): Promise<CreateResult> {
  if (!isOnline()) {
    const id = newRowId();
    await enqueue(KIND_SCENE_CREATE, id, { chapterId }, null);
    return { queued: true, id };
  }
  const id = await createScene(chapterId);
  return { queued: false, id: id ?? null };
}

/** NOTE: when online this delegates to createLooseScene, which REDIRECTS into
 *  the new note's editor (a Next redirect propagates from the action call). */
export async function createLooseSceneOffline(projectId: string): Promise<CreateResult> {
  if (!isOnline()) {
    const id = newRowId();
    await enqueue(KIND_LOOSE_CREATE, id, { projectId }, null);
    return { queued: true, id };
  }
  await createLooseScene(projectId);
  return { queued: false, id: null };
}

/** A queued (not yet on the server) create, for optimistic list rows. */
export type QueuedCreate = {
  kind: string;
  /** The client-generated row id. */
  id: string;
  /** projectId for chapter/loose creates; chapterId for scene creates. */
  parentId: string;
};

const CREATE_KINDS = new Set([KIND_CHAPTER_CREATE, KIND_SCENE_CREATE, KIND_LOOSE_CREATE]);

/**
 * List the creates still waiting in the outbox, so structure lists (the mobile
 * drawer) can render them as pending rows across remounts and reloads.
 */
export async function listQueuedCreates(): Promise<QueuedCreate[]> {
  const all = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return all
    .filter((e) => CREATE_KINDS.has(e.kind))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      kind: e.kind,
      id: e.entityId,
      parentId: String(e.payload.projectId ?? e.payload.chapterId ?? ""),
    }));
}

// FOLLOW-UPS:
// - tags + attach/split/merge flows (lower traffic, same handler pattern).
// - piece creation for flat forms (createPieceInProject) offline.
