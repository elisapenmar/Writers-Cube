"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RecoveredEdit = {
  id: string;
  entity_type: string;
  entity_id: string;
  word_count: number;
  created_at: string;
  value: unknown;
  /** The version currently live for this entity (the one that won the save),
   *  so the UI can show what the recovered edit actually changed. Null if the
   *  entity was deleted since. */
  current: unknown;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Unseen preserved edits (losers of same-field collisions) for the current user. */
export async function listRecoveredEdits(): Promise<RecoveredEdit[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("content_conflicts")
    .select("id, entity_type, entity_id, word_count, created_at, value")
    .is("seen_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const rows = (data ?? []) as Omit<RecoveredEdit, "current">[];

  // Pull the current live content for each entity in one query per table so the
  // UI can diff the recovered (losing) version against what's in place now.
  // Conflicts are only ever recorded for scenes and loose scenes.
  const idsByTable: Record<string, string[]> = { scenes: [], loose_scenes: [] };
  for (const r of rows) {
    if (r.entity_type === "scene") idsByTable.scenes.push(r.entity_id);
    else if (r.entity_type === "loose_scene") idsByTable.loose_scenes.push(r.entity_id);
  }
  const liveContent = new Map<string, unknown>();
  await Promise.all(
    (Object.keys(idsByTable) as ("scenes" | "loose_scenes")[]).map(async (table) => {
      const ids = idsByTable[table];
      if (ids.length === 0) return;
      const { data: live } = await supabase
        .from(table)
        .select("id, content")
        .in("id", ids);
      for (const row of live ?? []) {
        liveContent.set(`${table}:${(row as { id: string }).id}`, (row as { content: unknown }).content);
      }
    }),
  );

  return rows.map((r) => {
    const table = r.entity_type === "scene" ? "scenes" : r.entity_type === "loose_scene" ? "loose_scenes" : null;
    return {
      ...r,
      current: table ? liveContent.get(`${table}:${r.entity_id}`) ?? null : null,
    };
  });
}

/** Mark a recovered edit as reviewed so it stops surfacing in the notice. */
export async function dismissRecoveredEdit(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase
    .from("content_conflicts")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id);
}

/** Dismiss every currently-unseen recovered edit for the user. */
export async function dismissAllRecoveredEdits(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase
    .from("content_conflicts")
    .update({ seen_at: new Date().toISOString() })
    .is("seen_at", null);
}
