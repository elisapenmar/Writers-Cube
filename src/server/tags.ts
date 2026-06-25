"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveProjectId } from "@/server/project-context";
import { extractTags } from "@/lib/extract-tags";
import type { TagKind } from "@/lib/tags";

export type TagRowData = {
  kind: TagKind;
  sentence: string;
  tagOffsetInSentence: number;
  tagLengthInSentence: number;
  blockIndex: number;
  sentenceStart: number;
  sentenceEnd: number;
  sceneId: string;
  sceneTitle: string;
  chapterTitle: string;
};

/** All tagged passages across the active project's scenes (for the Tags panel). */
export async function listProjectTags(): Promise<TagRowData[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const chapterIds = (chapters ?? []).map((c) => c.id);

  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, title, position, content")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] as { id: string; chapter_id: string; title: string; content: unknown }[] };

  const chapterById = new Map(
    (chapters ?? []).map((c) => [c.id as string, c as { title?: string }]),
  );

  const rows: TagRowData[] = [];
  for (const scene of scenes ?? []) {
    const s = scene as { id: string; chapter_id: string; title: string; content: unknown };
    for (const p of extractTags(s.content)) {
      rows.push({
        ...p,
        sceneId: s.id,
        sceneTitle: s.title,
        chapterTitle: chapterById.get(s.chapter_id)?.title ?? "?",
      });
    }
  }
  return rows;
}
