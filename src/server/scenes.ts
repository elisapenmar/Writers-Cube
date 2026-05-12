"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTree, Chapter, Scene } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function getOrCreateProject(): Promise<ProjectTree> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let projectId: string;
  let title: string;

  if (existing) {
    projectId = existing.id;
    title = existing.title;
  } else {
    const { data: created, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: "My Novel" })
      .select("id, title")
      .single();
    if (error || !created) throw new Error(error?.message ?? "create project failed");
    projectId = created.id;
    title = created.title;
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

  return { id: projectId, title, chapters: chaptersWithScenes };
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
