"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTree, Chapter, Scene } from "@/lib/types";

const ACTIVE_PROJECT_COOKIE = "wc_active_project";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function isMissingProjectMetadata(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    (m.includes("author_name") || m.includes("agent_name")) &&
    (m.includes("column") || m.includes("does not exist"))
  );
}

const PROJECT_METADATA_REMINDER =
  "The 'author_name' / 'agent_name' columns are missing on projects. Run: alter table projects add column if not exists author_name text, add column if not exists agent_name text;";

export async function getOrCreateProject(): Promise<ProjectTree> {
  const { supabase, user } = await requireUser();

  // Honor the active-project cookie if it points to one of the user's projects.
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;

  type ProjectRow = {
    id: string;
    title: string;
    author_name: string | null;
    agent_name: string | null;
  };
  let existing: ProjectRow | null = null;
  let existingErr: { message?: string } | null = null;

  if (activeId) {
    const res = await supabase
      .from("projects")
      .select("id, title, author_name, agent_name")
      .eq("user_id", user.id)
      .eq("id", activeId)
      .maybeSingle();
    existing = res.data as ProjectRow | null;
    existingErr = res.error;
  }
  if (!existing) {
    const res = await supabase
      .from("projects")
      .select("id, title, author_name, agent_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existing = res.data as ProjectRow | null;
    existingErr = res.error;
  }
  if (existingErr) {
    if (isMissingProjectMetadata(existingErr)) throw new Error(PROJECT_METADATA_REMINDER);
    throw new Error(existingErr.message);
  }

  let projectId: string;
  let title: string;
  let author_name: string | null = null;
  let agent_name: string | null = null;

  if (existing) {
    projectId = existing.id;
    title = existing.title;
    author_name = (existing.author_name as string | null) ?? null;
    agent_name = (existing.agent_name as string | null) ?? null;
  } else {
    const { data: created, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: "My Novel" })
      .select("id, title, author_name, agent_name")
      .single();
    if (error || !created) {
      if (isMissingProjectMetadata(error)) throw new Error(PROJECT_METADATA_REMINDER);
      throw new Error(error?.message ?? "create project failed");
    }
    projectId = created.id;
    title = created.title;
    author_name = (created.author_name as string | null) ?? null;
    agent_name = (created.agent_name as string | null) ?? null;
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, project_id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  const chapterIds = (chapters ?? []).map((c) => c.id);
  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, title, position, content, word_count, updated_at")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] as Scene[] };

  const chaptersWithScenes: Chapter[] = (chapters ?? []).map((c) => ({
    ...c,
    scenes: (scenes ?? []).filter((s) => s.chapter_id === c.id),
  }));

  return { id: projectId, title, author_name, agent_name, chapters: chaptersWithScenes };
}

export async function updateProjectMetadata(
  projectId: string,
  patch: { title?: string; author_name?: string | null; agent_name?: string | null },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.title === "string") {
    update.title = patch.title.trim().slice(0, 200) || "Untitled";
  }
  if (patch.author_name !== undefined) {
    update.author_name = patch.author_name ? patch.author_name.trim().slice(0, 200) : null;
  }
  if (patch.agent_name !== undefined) {
    update.agent_name = patch.agent_name ? patch.agent_name.trim().slice(0, 200) : null;
  }
  const { error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId);
  if (error) {
    if (isMissingProjectMetadata(error)) throw new Error(PROJECT_METADATA_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app", "layout");
}

export async function createChapter(projectId: string) {
  const { supabase } = await requireUser();
  const { data: last } = await supabase
    .from("chapters")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      project_id: projectId,
      title: `Chapter ${position + 1}`,
      position,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create chapter failed");
  revalidatePath("/app", "layout");
  return data.id;
}

export async function createScene(chapterId: string) {
  const { supabase } = await requireUser();
  const { data: last } = await supabase
    .from("scenes")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("scenes")
    .insert({
      chapter_id: chapterId,
      title: `Scene ${position + 1}`,
      position,
      content: { type: "doc", content: [{ type: "paragraph" }] },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create scene failed");
  revalidatePath("/app", "layout");
  return data.id;
}

function countWordsInDoc(doc: unknown): number {
  let text = "";
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") text += " " + n.text;
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function updateSceneContent(sceneId: string, content: unknown) {
  const { supabase } = await requireUser();
  const word_count = countWordsInDoc(content);
  const { error } = await supabase
    .from("scenes")
    .update({ content, word_count, updated_at: new Date().toISOString() })
    .eq("id", sceneId);
  if (error) throw new Error(error.message);
  return { word_count, savedAt: new Date().toISOString() };
}

export async function renameChapter(chapterId: string, title: string) {
  const { supabase } = await requireUser();
  const trimmed = title.trim().slice(0, 200) || "Untitled chapter";
  const { error } = await supabase
    .from("chapters")
    .update({ title: trimmed })
    .eq("id", chapterId);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
  return trimmed;
}

export async function renameScene(sceneId: string, title: string) {
  const { supabase } = await requireUser();
  const trimmed = title.trim().slice(0, 200) || "Untitled scene";
  const { error } = await supabase
    .from("scenes")
    .update({ title: trimmed })
    .eq("id", sceneId);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
  return trimmed;
}

export async function reorderChapters(projectId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();
  await Promise.all(
    orderedIds.map((id, position) =>
      supabase
        .from("chapters")
        .update({ position })
        .eq("id", id)
        .eq("project_id", projectId),
    ),
  );
  revalidatePath("/app", "layout");
}

export async function reorderScenes(chapterId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();
  await Promise.all(
    orderedIds.map((id, position) =>
      supabase
        .from("scenes")
        .update({ position })
        .eq("id", id)
        .eq("chapter_id", chapterId),
    ),
  );
  revalidatePath("/app", "layout");
}

type DocNode = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
};

const TAG_MARK_TYPES = new Set([
  "tag",
  "tagLookup",
  "tagRevise",
  "tagWeak",
  "tagFactcheck",
  "tagPlaceholder",
]);

/**
 * Replace the character range [sentenceStart, sentenceEnd) in the Nth
 * paragraph-like block with newText. If `keepTagKind` is provided, the
 * inserted text gets that tag mark; otherwise the range becomes plain text.
 * Any other marks (bold/italic) within the replaced range are dropped — V0.5
 * accepts this tradeoff for sentence-level edits from the Tags view.
 */
function rewriteSentenceInDoc(
  doc: DocNode,
  targetBlockIndex: number,
  sentenceStart: number,
  sentenceEnd: number,
  newText: string,
  keepTagMarkName: string | null,
): boolean {
  let blockCounter = -1;
  let mutated = false;

  const visitBlock = (block: DocNode) => {
    blockCounter += 1;
    if (blockCounter !== targetBlockIndex) return;
    if (!Array.isArray(block.content)) return;

    const newChildren: DocNode[] = [];
    let cursor = 0;
    let insertedReplacement = false;

    const insertReplacement = () => {
      if (insertedReplacement) return;
      insertedReplacement = true;
      if (!newText) return;
      const marks = keepTagMarkName ? [{ type: keepTagMarkName }] : undefined;
      newChildren.push({
        type: "text",
        text: newText,
        ...(marks ? { marks } : {}),
      });
    };

    for (const child of block.content) {
      if (child.type !== "text") {
        // Inline non-text node: only keep if it falls outside the replaced range.
        const pointPos = cursor;
        if (pointPos < sentenceStart || pointPos >= sentenceEnd) {
          newChildren.push(child);
        }
        continue;
      }
      const text = child.text ?? "";
      const start = cursor;
      const end = cursor + text.length;
      cursor = end;

      if (end <= sentenceStart || start >= sentenceEnd) {
        // No overlap — keep as-is.
        newChildren.push(child);
        continue;
      }
      // Some overlap: keep prefix outside sentence range, drop inside, keep suffix.
      const headEnd = Math.max(0, sentenceStart - start);
      const tailStart = Math.max(0, sentenceEnd - start);

      if (headEnd > 0) {
        newChildren.push({ ...child, text: text.slice(0, headEnd) });
      }
      if (start <= sentenceStart) {
        insertReplacement();
      }
      if (tailStart < text.length) {
        newChildren.push({ ...child, text: text.slice(tailStart) });
      }
    }

    // Edge case: sentence boundary is at the end of the block (no text node spans it).
    if (!insertedReplacement) insertReplacement();

    block.content = newChildren.filter(
      (c) => c.type !== "text" || (c.text && c.text.length > 0),
    );
    mutated = true;
  };

  const walk = (node: DocNode) => {
    if (mutated) return;
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      (node.type === "blockquote" && !Array.isArray(node.content?.[0]?.content))
    ) {
      visitBlock(node);
      return;
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) {
        if (mutated) return;
        walk(c);
      }
    }
  };

  walk(doc);
  return mutated;
}

function countWords(doc: DocNode): number {
  let text = "";
  const walk = (n: DocNode) => {
    if (n.type === "text") text += " " + (n.text ?? "");
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function updateTaggedSentence(input: {
  sceneId: string;
  blockIndex: number;
  sentenceStart: number;
  sentenceEnd: number;
  newText: string;
  /** If null, the sentence becomes plain text (resolved). Otherwise the tag mark
   * with this name is applied to the new sentence text. */
  keepTagMarkName: string | null;
}) {
  const { supabase } = await requireUser();
  const { data: scene, error: readErr } = await supabase
    .from("scenes")
    .select("content")
    .eq("id", input.sceneId)
    .maybeSingle();
  if (readErr || !scene) throw new Error(readErr?.message ?? "scene not found");

  const doc = scene.content as DocNode | null;
  if (!doc) throw new Error("scene has no content");

  const ok = rewriteSentenceInDoc(
    doc,
    input.blockIndex,
    input.sentenceStart,
    input.sentenceEnd,
    input.newText.trim(),
    input.keepTagMarkName,
  );
  if (!ok) {
    throw new Error("Sentence no longer matches — reload the page");
  }

  const word_count = countWords(doc);
  const { error } = await supabase
    .from("scenes")
    .update({ content: doc, word_count, updated_at: new Date().toISOString() })
    .eq("id", input.sceneId);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
  revalidatePath("/app/tags");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
