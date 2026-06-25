"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveProjectId } from "@/server/project-context";

export type LinkTargets = {
  scenes: { id: string; title: string; chapter: string }[];
  characters: { id: string; name: string }[];
};

/** Scenes (story moments) and characters in the active project, for link pickers. */
export async function listLinkTargets(): Promise<LinkTargets> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return { scenes: [], characters: [] };

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const chapterTitle = new Map(
    (chapters ?? []).map((c) => [c.id as string, String(c.title ?? "")]),
  );
  const chapterIds = (chapters ?? []).map((c) => c.id as string);

  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, title, position")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] as { id: string; chapter_id: string; title: string }[] };

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  return {
    scenes: (scenes ?? []).map((s) => ({
      id: s.id as string,
      title: String((s as { title?: string }).title ?? "Untitled scene"),
      chapter: chapterTitle.get((s as { chapter_id: string }).chapter_id) ?? "",
    })),
    characters: (characters ?? [])
      .filter((c) => String(c.name ?? "").trim())
      .map((c) => ({ id: c.id as string, name: String(c.name) })),
  };
}
