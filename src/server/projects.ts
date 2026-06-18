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
  updated_at: string;
  created_at: string;
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

export async function listProjects(): Promise<ProjectSummary[]> {
  const { supabase, user } = await requireUser();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, author_name, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
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
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
  }));
}

export async function createProject(title?: string): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, title: title?.trim() || "Untitled Project" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create project failed");
  await setActiveProject(data.id as string);
  revalidatePath("/app", "layout");
  return { id: data.id as string };
}

export async function openProject(projectId: string): Promise<void> {
  await setActiveProject(projectId);
  redirect("/app");
}
