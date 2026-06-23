"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SceneVersion = { id: string; word_count: number; created_at: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function countWords(doc: unknown): number {
  // Plain text (e.g. notes) or a TipTap doc — handle both.
  if (typeof doc === "string") {
    return doc.trim().split(/\s+/).filter(Boolean).length;
  }
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000; // at most one snapshot per 3 minutes

export type ContentVersion = { id: string; word_count: number; created_at: string };

/**
 * Generic, append-only version snapshot for any content type (loose scenes,
 * notes, …). Throttled by default; pass { force: true } for safety snapshots.
 */
export async function snapshotContent(
  entityType: string,
  entityId: string,
  content: unknown,
  opts?: { force?: boolean },
): Promise<void> {
  try {
    if (content == null || content === "") return;
    const { supabase, user } = await requireUser();
    if (!opts?.force) {
      const { data: last } = await supabase
        .from("content_versions")
        .select("created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && Date.now() - new Date(last.created_at as string).getTime() < SNAPSHOT_INTERVAL_MS) {
        return;
      }
    }
    await supabase.from("content_versions").insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      content,
      word_count: countWords(content),
    });
  } catch {
    // History is best-effort; never block a save.
  }
}

export async function listContentVersions(
  entityType: string,
  entityId: string,
): Promise<ContentVersion[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("content_versions")
    .select("id, word_count, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as ContentVersion[];
}

export async function getContentVersion(versionId: string): Promise<unknown> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("content_versions")
    .select("content")
    .eq("id", versionId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.content ?? null;
}

/**
 * Record a version snapshot for a scene. Throttled by default so autosaves don't
 * flood the history; pass { force: true } for safety snapshots (e.g. before a
 * destructive write) that must always be captured.
 */
export async function snapshotScene(
  sceneId: string,
  content: unknown,
  opts?: { force?: boolean },
): Promise<void> {
  try {
    if (!content) return;
    const { supabase, user } = await requireUser();
    if (!opts?.force) {
      const { data: last } = await supabase
        .from("scene_versions")
        .select("created_at")
        .eq("scene_id", sceneId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && Date.now() - new Date(last.created_at as string).getTime() < SNAPSHOT_INTERVAL_MS) {
        return;
      }
    }
    await supabase.from("scene_versions").insert({
      scene_id: sceneId,
      user_id: user.id,
      content,
      word_count: countWords(content),
    });
  } catch {
    // History is best-effort; never block a save.
  }
}

export async function listSceneVersions(sceneId: string): Promise<SceneVersion[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("scene_versions")
    .select("id, word_count, created_at")
    .eq("scene_id", sceneId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (error.message.includes("scene_versions")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as SceneVersion[];
}

export async function getSceneVersionContent(versionId: string): Promise<unknown> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("scene_versions")
    .select("content")
    .eq("id", versionId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.content ?? null;
}

/** Restore a scene to a past version (snapshotting the current state first). */
export async function restoreSceneVersion(
  versionId: string,
): Promise<{ content: unknown }> {
  const { supabase, user } = await requireUser();
  const { data: version } = await supabase
    .from("scene_versions")
    .select("scene_id, content")
    .eq("id", versionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!version) throw new Error("Version not found");
  const sceneId = version.scene_id as string;

  // Snapshot the current content so the restore itself is undoable.
  const { data: scene } = await supabase
    .from("scenes")
    .select("content")
    .eq("id", sceneId)
    .maybeSingle();
  if (scene?.content) {
    await supabase.from("scene_versions").insert({
      scene_id: sceneId,
      user_id: user.id,
      content: scene.content,
      word_count: countWords(scene.content),
    });
  }

  await supabase
    .from("scenes")
    .update({
      content: version.content,
      word_count: countWords(version.content),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sceneId);

  revalidatePath("/app", "layout");
  return { content: version.content };
}
