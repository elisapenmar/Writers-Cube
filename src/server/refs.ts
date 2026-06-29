"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveProjectId } from "@/server/project-context";
import type { StoryElement } from "@/lib/story-elements";

export type LinkTargets = {
  scenes: { id: string; title: string; chapter: string }[];
  characters: { id: string; name: string }[];
};

/**
 * Every named story element in the active project (characters, places, items),
 * flattened for the editor's Smart Text recognizer + type-ahead. Places/Items
 * are queried defensively so this keeps working before those tables exist.
 */
export async function listStoryElements(): Promise<StoryElement[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];

  const out: StoryElement[] = [];
  const tables: { table: string; kind: StoryElement["kind"] }[] = [
    { table: "characters", kind: "character" },
    { table: "places", kind: "place" },
    { table: "items", kind: "item" },
  ];
  for (const { table, kind } of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    if (error) continue; // table not created yet, or transient — skip this kind
    for (const row of data ?? []) {
      const name = String((row as { name?: unknown }).name ?? "").trim();
      if (name) out.push({ id: (row as { id: string }).id, name, kind });
    }
  }
  return out;
}

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
