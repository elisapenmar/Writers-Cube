"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_PROJECT_COOKIE = "wc_active_project";

export type ProjectSummary = {
  id: string;
  title: string;
  author_name: string | null;
  word_count: number;
  chapter_count: number;
  word_goal: number | null;
  updated_at: string;
  created_at: string;
  archived_at: string | null;
  folder_id: string | null;
};

export type ProjectFolder = {
  id: string;
  name: string;
  position: number;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Read the active project id from the cookie, if any. */
export async function getActiveProjectId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
}

export async function setActiveProject(projectId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROJECT_COOKIE, projectId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/app", "layout");
}

async function fetchProjects(archived: boolean): Promise<ProjectSummary[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("projects")
    .select("id, title, author_name, word_goal, created_at, updated_at, archived_at, folder_id")
    .eq("user_id", user.id);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data: projects, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (projects ?? []).map((p) => p.id);
  // Aggregate word counts + chapter counts per project.
  const counts = new Map<string, { words: number; chapters: number }>();
  if (ids.length > 0) {
    const { data: chapters } = await supabase
      .from("chapters")
      .select("id, project_id")
      .in("project_id", ids);
    const chapterIds = (chapters ?? []).map((c) => c.id);
    const chapterToProject = new Map(
      (chapters ?? []).map((c) => [c.id, c.project_id as string]),
    );
    for (const c of chapters ?? []) {
      const entry = counts.get(c.project_id as string) ?? { words: 0, chapters: 0 };
      entry.chapters += 1;
      counts.set(c.project_id as string, entry);
    }
    if (chapterIds.length > 0) {
      const { data: scenes } = await supabase
        .from("scenes")
        .select("chapter_id, word_count")
        .in("chapter_id", chapterIds);
      for (const s of scenes ?? []) {
        const projectId = chapterToProject.get(s.chapter_id as string);
        if (!projectId) continue;
        const entry = counts.get(projectId) ?? { words: 0, chapters: 0 };
        entry.words += (s.word_count as number) ?? 0;
        counts.set(projectId, entry);
      }
    }
  }

  return (projects ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    author_name: (p.author_name as string | null) ?? null,
    word_count: counts.get(p.id as string)?.words ?? 0,
    chapter_count: counts.get(p.id as string)?.chapters ?? 0,
    word_goal: (p.word_goal as number | null) ?? null,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
    archived_at: (p.archived_at as string | null) ?? null,
    folder_id: (p.folder_id as string | null) ?? null,
  }));
}

/** Folders the user has created for organizing projects (ordered). */
export async function listFolders(): Promise<ProjectFolder[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("project_folders")
    .select("id, name, position")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    position: (f.position as number) ?? 0,
  }));
}

export async function createFolder(name: string): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const { data: last } = await supabase
    .from("project_folders")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;
  const { data, error } = await supabase
    .from("project_folders")
    .insert({ user_id: user.id, name: name.trim().slice(0, 80) || "New folder", position })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create folder failed");
  revalidatePath("/app", "layout");
  return { id: data.id as string };
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_folders")
    .update({ name: name.trim().slice(0, 80) || "Untitled folder" })
    .eq("id", folderId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/** Delete a folder; its projects fall back to "All" (folder_id set null by FK). */
export async function deleteFolder(folderId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_folders")
    .delete()
    .eq("id", folderId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/** File a project into a folder, or pass null to move it back to "All". */
export async function moveProjectToFolder(
  projectId: string,
  folderId: string | null,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ folder_id: folderId })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/** Active (non-archived) projects. */
export async function listProjects(): Promise<ProjectSummary[]> {
  return fetchProjects(false);
}

/** Archived projects. */
export async function listArchivedProjects(): Promise<ProjectSummary[]> {
  return fetchProjects(true);
}

/** Set (or clear, with null) the project's target word count. */
export async function setProjectWordGoal(
  projectId: string,
  goal: number | null,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const value = goal && goal > 0 ? Math.round(goal) : null;
  const { error } = await supabase
    .from("projects")
    .update({ word_goal: value })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

export async function archiveProject(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

export async function unarchiveProject(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/** Permanently delete a project and everything under it. Irreversible. */
export async function deleteProjectForever(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  // Confirm ownership before destroying anything.
  const { data: owned } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) throw new Error("Project not found");

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", id);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  if (chapterIds.length > 0) {
    await supabase.from("scenes").delete().in("chapter_id", chapterIds);
  }
  await supabase.from("chapters").delete().eq("project_id", id);
  await supabase.from("loose_scenes").delete().eq("project_id", id);
  await supabase.from("prompt_exercises").delete().eq("project_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

export async function createProject(title?: string, form?: string): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const f = ["novel", "short_story", "poetry", "essay"].includes(form ?? "") ? form : "novel";
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, title: title?.trim() || "Untitled Project", form: f })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create project failed");
  await setActiveProject(data.id as string);
  revalidatePath("/app", "layout");
  return { id: data.id as string };
}

function docWordCount(doc: unknown): number {
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

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Spin a standalone piece of writing (a kernel or a practice piece) into a new
 * project: creates the project, a first chapter, and a scene holding `content`,
 * then makes it the active project. Returns the new project id.
 */
export async function createProjectFromContent(
  title: string,
  content: unknown,
): Promise<{ id: string }> {
  const { id } = await createProject(title || undefined, "novel");

  const { supabase } = await requireUser();
  const doc =
    content && typeof content === "object" &&
    (content as { type?: string }).type === "doc"
      ? content
      : EMPTY_DOC;

  const { data: chap, error: cErr } = await supabase
    .from("chapters")
    .insert({ project_id: id, title: "Chapter 1", position: 0 })
    .select("id")
    .single();
  if (cErr || !chap) throw new Error(cErr?.message ?? "create chapter failed");

  const { error: sErr } = await supabase.from("scenes").insert({
    chapter_id: chap.id as string,
    title: "Scene 1",
    position: 0,
    content: doc,
    word_count: docWordCount(doc),
  });
  if (sErr) throw new Error(sErr.message);

  revalidatePath("/app", "layout");
  return { id };
}

export async function openProject(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  if (projectId) await setActiveProject(projectId);
  redirect("/app/manuscript");
}

export async function createProjectAndOpen(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const form = String(formData.get("form") ?? "novel");
  await createProject(title || undefined, form);
  redirect("/app/manuscript");
}

/** Change a project's form (novel / short_story / poetry / essay). */
export async function updateProjectForm(projectId: string, form: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const f = ["novel", "short_story", "poetry", "essay"].includes(form) ? form : "novel";
  const { error } = await supabase
    .from("projects")
    .update({ form: f })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}
