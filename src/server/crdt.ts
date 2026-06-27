"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Which durable CRDT store a doc lives in. Each kind has its own RLS. */
export type CrdtKind = "scene" | "loose_scene";

const TABLES: Record<CrdtKind, { table: string; key: string }> = {
  scene: { table: "scene_crdt", key: "scene_id" },
  loose_scene: { table: "loose_scene_crdt", key: "loose_scene_id" },
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Load the latest encoded Y.Doc snapshot (base64) for an entity, or null. */
export async function loadCrdt(kind: CrdtKind, id: string): Promise<string | null> {
  const { supabase } = await requireUser();
  const { table, key } = TABLES[kind];
  const { data, error } = await supabase
    .from(table)
    .select("state")
    .eq(key, id)
    .maybeSingle();
  if (error) return null; // table missing / no access — fall back to the blob
  return (data?.state as string | undefined) ?? null;
}

/**
 * Persist a full-state Y.Doc snapshot. Last-write-wins is correct: any client's
 * snapshot is convergent, so applying any of them yields the merged document.
 * The entity's JSONB content row remains the durable source of truth.
 */
export async function saveCrdt(kind: CrdtKind, id: string, state: string): Promise<void> {
  const { supabase } = await requireUser();
  const { table, key } = TABLES[kind];
  await supabase
    .from(table)
    .upsert({ [key]: id, state, updated_at: new Date().toISOString() }, { onConflict: key });
}

/**
 * Atomically decide which client seeds a fresh shared doc from the JSONB blob.
 * Inserts an empty placeholder row only if none exists; the caller that wins the
 * insert (true) seeds, everyone else (false) waits for the seed to sync. This
 * prevents duplicated content when two clients open a cold scene at once.
 */
export async function claimCrdtSeed(kind: CrdtKind, id: string): Promise<boolean> {
  const { supabase } = await requireUser();
  const { table, key } = TABLES[kind];
  const { data } = await supabase
    .from(table)
    .upsert(
      { [key]: id, state: "", updated_at: new Date().toISOString() },
      { onConflict: key, ignoreDuplicates: true },
    )
    .select(key);
  return (data?.length ?? 0) > 0; // a row returned => we inserted it => we seed
}
