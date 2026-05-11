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

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
