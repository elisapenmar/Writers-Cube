"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { snapshotScene } from "@/server/versions";
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
    form: string | null;
  };
  let existing: ProjectRow | null = null;
  let existingErr: { message?: string } | null = null;

  if (activeId) {
    const res = await supabase
      .from("projects")
      .select("id, title, author_name, agent_name, form")
      .eq("user_id", user.id)
      .eq("id", activeId)
      .maybeSingle();
    existing = res.data as ProjectRow | null;
    existingErr = res.error;
  }
  if (!existing) {
    const res = await supabase
      .from("projects")
      .select("id, title, author_name, agent_name, form")
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
  let form = "novel";

  if (existing) {
    projectId = existing.id;
    title = existing.title;
    author_name = (existing.author_name as string | null) ?? null;
    agent_name = (existing.agent_name as string | null) ?? null;
    form = (existing.form as string | null) ?? "novel";
  } else {
    const { data: created, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: "My Novel" })
      .select("id, title, author_name, agent_name, form")
      .single();
    if (error || !created) {
      if (isMissingProjectMetadata(error)) throw new Error(PROJECT_METADATA_REMINDER);
      throw new Error(error?.message ?? "create project failed");
    }
    projectId = created.id;
    title = created.title;
    author_name = (created.author_name as string | null) ?? null;
    agent_name = (created.agent_name as string | null) ?? null;
    form = (created.form as string | null) ?? "novel";
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

  return { id: projectId, title, author_name, agent_name, form, chapters: chaptersWithScenes };
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

/** Change a project's form (novel / short_story / poetry / essay). */
export async function updateProjectForm(projectId: string, form: string): Promise<void> {
  const { supabase } = await requireUser();
  const allowed = ["novel", "short_story", "poetry", "essay"];
  const f = allowed.includes(form) ? form : "novel";
  const { error } = await supabase
    .from("projects")
    .update({ form: f, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
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

/** Flat forms (poetry/short story/essay): add a piece, creating the single
 *  holding chapter if needed. Returns the new scene id. */
export async function createPieceInProject(projectId: string): Promise<string> {
  const { supabase } = await requireUser();
  let { data: chapter } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!chapter) {
    const { data: created, error } = await supabase
      .from("chapters")
      .insert({ project_id: projectId, title: "Pieces", position: 0 })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "create failed");
    chapter = created;
  }
  return createScene(chapter.id as string);
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

/** Move an uncategorized item (loose scene or exercise) into a chapter as a scene. */
export async function attachUncategorizedToChapter(
  itemId: string,
  kind: "loose" | "exercise",
  chapterId: string,
): Promise<{ sceneId: string }> {
  const { supabase, user } = await requireUser();
  const { data: last } = await supabase
    .from("scenes")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  let title = "Scene";
  let content: unknown = { type: "doc", content: [{ type: "paragraph" }] };
  let word_count = 0;

  if (kind === "loose") {
    const { data } = await supabase
      .from("loose_scenes")
      .select("title, content, word_count")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Item not found");
    title = (data.title as string) || "Scene";
    content = data.content ?? content;
    word_count = (data.word_count as number) ?? 0;
  } else {
    const { data } = await supabase
      .from("prompt_exercises")
      .select("title, prompt, content, word_count")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Item not found");
    const promptText = (data.prompt as { text?: string } | null)?.text ?? "";
    title = (data.title as string) || promptText || "Scene";
    const existing = (data.content as { content?: unknown[] } | null)?.content ?? [];
    content = promptText
      ? {
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [{ type: "paragraph", content: [{ type: "text", text: promptText }] }],
            },
            ...existing,
          ],
        }
      : data.content ?? content;
    word_count = (data.word_count as number) ?? 0;
  }

  const { data: scene, error } = await supabase
    .from("scenes")
    .insert({ chapter_id: chapterId, title: title.slice(0, 200), position, content, word_count })
    .select("id")
    .single();
  if (error || !scene) throw new Error(error?.message ?? "Could not move item");

  if (kind === "loose") await supabase.from("loose_scenes").delete().eq("id", itemId);
  else await supabase.from("prompt_exercises").delete().eq("id", itemId);

  revalidatePath("/app", "layout");
  return { sceneId: scene.id as string };
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

type Block = { type?: string; content?: unknown[]; attrs?: Record<string, unknown> };

function blockText(b: Block): string {
  let t = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") t += node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(b);
  return t.trim();
}

/** A paragraph that is only a scene-break glyph (`* * *`, `---`, `❧`, …). */
function isSceneBreak(b: Block): boolean {
  if (b.type !== "paragraph") return false;
  const norm = blockText(b).replace(/\s+/g, "");
  if (!norm) return false;
  return /^(\*{3,}|-{3,}|~{3,}|#{3,}|•{3,}|◆{3,}|·{3,})$/.test(norm) || /^(❧|⁂|§)$/.test(norm);
}

/** A heading node, or a markdown-ish `#`/`##` line → starts a new chapter. */
function chapterBreakTitle(b: Block): string | null {
  if (b.type === "heading") return blockText(b) || "Untitled chapter";
  if (b.type === "paragraph") {
    const m = blockText(b).match(/^#{1,3}\s+(.+)$/);
    if (m) return m[1].trim() || "Untitled chapter";
  }
  return null;
}

function docOf(blocks: unknown[]): { type: "doc"; content: unknown[] } {
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

/**
 * Split an existing scene's text into multiple scenes or chapters.
 *  - "scenes":   break at scene-break lines (`* * *`); new scenes go in the
 *    same chapter, right after the original.
 *  - "chapters": break at headings (or `#`/`##` lines); each becomes a new
 *    chapter (with one scene) after the current one.
 */
export async function splitScene(
  sceneId: string,
  into: "scenes" | "chapters",
): Promise<{ created: number; firstContent: { type: "doc"; content: unknown[] } }> {
  const { supabase } = await requireUser();
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, chapter_id, title, position, content")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) throw new Error("Scene not found");

  // Safety: capture the whole pre-split scene so the split is reversible.
  await snapshotScene(sceneId, scene.content, { force: true });

  const doc = scene.content as { content?: Block[] } | null;
  const blocks: Block[] = Array.isArray(doc?.content) ? (doc!.content as Block[]) : [];

  if (into === "scenes") {
    // Partition at scene-break blocks (dropping the breaks).
    const segments: Block[][] = [[]];
    for (const b of blocks) {
      if (isSceneBreak(b)) segments.push([]);
      else segments[segments.length - 1].push(b);
    }
    const nonEmpty = segments.filter((s) => s.some((b) => blockText(b) !== ""));
    if (nonEmpty.length <= 1) {
      throw new Error(
        "No scene breaks found. Put “* * *” on its own line where each new scene should begin, then split.",
      );
    }
    const rest = nonEmpty.slice(1);

    // Shift later scenes in this chapter to make room.
    const { data: siblings } = await supabase
      .from("scenes")
      .select("id, position")
      .eq("chapter_id", scene.chapter_id)
      .gt("position", scene.position as number)
      .order("position", { ascending: false });
    for (const s of siblings ?? []) {
      await supabase
        .from("scenes")
        .update({ position: (s.position as number) + rest.length })
        .eq("id", s.id);
    }

    // Original scene keeps the first segment.
    await supabase
      .from("scenes")
      .update({
        content: docOf(nonEmpty[0]),
        word_count: countWordsInDoc(docOf(nonEmpty[0])),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scene.id);

    // Insert the rest.
    for (let i = 0; i < rest.length; i++) {
      const pos = (scene.position as number) + 1 + i;
      await supabase.from("scenes").insert({
        chapter_id: scene.chapter_id,
        title: `Scene ${pos + 1}`,
        position: pos,
        content: docOf(rest[i]),
        word_count: countWordsInDoc(docOf(rest[i])),
      });
    }
    revalidatePath("/app", "layout");
    return { created: rest.length, firstContent: docOf(nonEmpty[0]) };
  }

  // into === "chapters"
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, project_id, position")
    .eq("id", scene.chapter_id)
    .maybeSingle();
  if (!chapter) throw new Error("Chapter not found");

  const segments: { title: string | null; blocks: Block[] }[] = [{ title: null, blocks: [] }];
  for (const b of blocks) {
    const title = chapterBreakTitle(b);
    if (title) segments.push({ title, blocks: [] });
    else segments[segments.length - 1].blocks.push(b);
  }
  const newChapters = segments.slice(1).filter((s) => s.title);
  if (newChapters.length === 0) {
    throw new Error(
      "No chapter breaks found. Make a heading (or a line starting with “# ”) where each new chapter should begin, then split.",
    );
  }

  // Original scene keeps the content before the first chapter break.
  await supabase
    .from("scenes")
    .update({
      content: docOf(segments[0].blocks),
      word_count: countWordsInDoc(docOf(segments[0].blocks)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scene.id);

  // Shift later chapters to make room.
  const { data: laterChapters } = await supabase
    .from("chapters")
    .select("id, position")
    .eq("project_id", chapter.project_id)
    .gt("position", chapter.position as number)
    .order("position", { ascending: false });
  for (const c of laterChapters ?? []) {
    await supabase
      .from("chapters")
      .update({ position: (c.position as number) + newChapters.length })
      .eq("id", c.id);
  }

  // Create each new chapter with a single scene.
  for (let i = 0; i < newChapters.length; i++) {
    const seg = newChapters[i];
    const { data: ch } = await supabase
      .from("chapters")
      .insert({
        project_id: chapter.project_id,
        title: seg.title,
        position: (chapter.position as number) + 1 + i,
      })
      .select("id")
      .single();
    if (ch) {
      await supabase.from("scenes").insert({
        chapter_id: ch.id,
        title: "Scene 1",
        position: 0,
        content: docOf(seg.blocks),
        word_count: countWordsInDoc(docOf(seg.blocks)),
      });
    }
  }
  revalidatePath("/app", "layout");
  return { created: newChapters.length, firstContent: docOf(segments[0].blocks) };
}

/**
 * Split a scene at a specific top-level block index (e.g. from a right-click in
 * the editor). Blocks before `blockIndex` stay; blocks from `blockIndex` on go
 * to a new scene (same chapter) or a new chapter right after this one.
 */
export async function splitSceneAt(
  sceneId: string,
  blockIndex: number,
  into: "scenes" | "chapters",
): Promise<{ firstContent: { type: "doc"; content: unknown[] } }> {
  const { supabase } = await requireUser();
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, chapter_id, title, position, content")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) throw new Error("Scene not found");

  const doc = scene.content as { content?: Block[] } | null;
  const blocks: Block[] = Array.isArray(doc?.content) ? (doc!.content as Block[]) : [];
  if (blockIndex <= 0 || blockIndex >= blocks.length) {
    throw new Error("Pick a spot inside the text (not the very start or end) to split.");
  }
  // Safety: capture the whole pre-split scene so the split is reversible.
  await snapshotScene(sceneId, scene.content, { force: true });

  const head = blocks.slice(0, blockIndex);
  const tail = blocks.slice(blockIndex);

  await supabase
    .from("scenes")
    .update({
      content: docOf(head),
      word_count: countWordsInDoc(docOf(head)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scene.id);

  if (into === "scenes") {
    const { data: siblings } = await supabase
      .from("scenes")
      .select("id, position")
      .eq("chapter_id", scene.chapter_id)
      .gt("position", scene.position as number)
      .order("position", { ascending: false });
    for (const s of siblings ?? []) {
      await supabase
        .from("scenes")
        .update({ position: (s.position as number) + 1 })
        .eq("id", s.id);
    }
    const pos = (scene.position as number) + 1;
    await supabase.from("scenes").insert({
      chapter_id: scene.chapter_id,
      title: `Scene ${pos + 1}`,
      position: pos,
      content: docOf(tail),
      word_count: countWordsInDoc(docOf(tail)),
    });
  } else {
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, project_id, position")
      .eq("id", scene.chapter_id)
      .maybeSingle();
    if (!chapter) throw new Error("Chapter not found");
    const { data: later } = await supabase
      .from("chapters")
      .select("id, position")
      .eq("project_id", chapter.project_id)
      .gt("position", chapter.position as number)
      .order("position", { ascending: false });
    for (const c of later ?? []) {
      await supabase
        .from("chapters")
        .update({ position: (c.position as number) + 1 })
        .eq("id", c.id);
    }
    const title = blockText(tail[0]).slice(0, 80) || "New chapter";
    const { data: ch } = await supabase
      .from("chapters")
      .insert({ project_id: chapter.project_id, title, position: (chapter.position as number) + 1 })
      .select("id")
      .single();
    if (ch) {
      await supabase.from("scenes").insert({
        chapter_id: ch.id,
        title: "Scene 1",
        position: 0,
        content: docOf(tail),
        word_count: countWordsInDoc(docOf(tail)),
      });
    }
  }
  revalidatePath("/app", "layout");
  return { firstContent: docOf(head) };
}

/** Merge a scene with its previous or next sibling in the same chapter. */
export async function mergeScene(
  sceneId: string,
  direction: "previous" | "next",
): Promise<{ sceneId: string }> {
  const { supabase } = await requireUser();
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, chapter_id, position, content")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) throw new Error("Scene not found");

  const otherPos = (scene.position as number) + (direction === "previous" ? -1 : 1);
  const { data: other } = await supabase
    .from("scenes")
    .select("id, position, content")
    .eq("chapter_id", scene.chapter_id)
    .eq("position", otherPos)
    .maybeSingle();
  if (!other) {
    throw new Error(
      direction === "previous"
        ? "This is the first scene in the chapter — nothing to merge into."
        : "This is the last scene in the chapter — nothing to merge with.",
    );
  }

  // The earlier scene keeps the combined content; the later one is removed.
  const earlier = direction === "previous" ? other : scene;
  const later = direction === "previous" ? scene : other;
  const earlierBlocks = ((earlier.content as { content?: Block[] } | null)?.content ?? []) as Block[];
  const laterBlocks = ((later.content as { content?: Block[] } | null)?.content ?? []) as Block[];
  const merged = docOf([...earlierBlocks, ...laterBlocks]);

  // Safety: snapshot both scenes' pre-merge content (the later scene is deleted,
  // so this is the only place its standalone history survives the merge).
  await snapshotScene(earlier.id, earlier.content, { force: true });
  await snapshotScene(earlier.id, later.content, { force: true });

  await supabase
    .from("scenes")
    .update({
      content: merged,
      word_count: countWordsInDoc(merged),
      updated_at: new Date().toISOString(),
    })
    .eq("id", earlier.id);

  await supabase.from("scenes").delete().eq("id", later.id);

  // Close the gap left by the removed scene.
  const { data: after } = await supabase
    .from("scenes")
    .select("id, position")
    .eq("chapter_id", scene.chapter_id)
    .gt("position", later.position as number)
    .order("position", { ascending: true });
  for (const s of after ?? []) {
    await supabase
      .from("scenes")
      .update({ position: (s.position as number) - 1 })
      .eq("id", s.id);
  }

  revalidatePath("/app", "layout");
  return { sceneId: earlier.id as string };
}

export async function updateSceneContent(sceneId: string, content: unknown) {
  const { supabase } = await requireUser();
  const word_count = countWordsInDoc(content);

  // Write-safety guard: if this save empties or sharply shrinks the scene,
  // force-snapshot the CURRENT content first so the prior words are always
  // recoverable from History — even if a bug or a stray autosave caused it.
  const { data: cur } = await supabase
    .from("scenes")
    .select("content, word_count")
    .eq("id", sceneId)
    .maybeSingle();
  const curWords = (cur?.word_count as number) ?? 0;
  const emptiesIt = word_count === 0 && curWords > 0;
  const bigShrink = curWords >= 40 && word_count < curWords * 0.5;
  if (cur?.content && (emptiesIt || bigShrink)) {
    await snapshotScene(sceneId, cur.content, { force: true });
  }

  const { error } = await supabase
    .from("scenes")
    .update({ content, word_count, updated_at: new Date().toISOString() })
    .eq("id", sceneId);
  if (error) throw new Error(error.message);
  // Throttled version snapshot for the history timeline (best-effort).
  await snapshotScene(sceneId, content);
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
