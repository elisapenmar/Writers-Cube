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
  return (data ?? []) as RecoveredEdit[];
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
