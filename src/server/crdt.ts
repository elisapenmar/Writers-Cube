"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Load the latest encoded Y.Doc snapshot for a scene (base64), or null. */
export async function loadSceneCrdt(sceneId: string): Promise<string | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("scene_crdt")
    .select("state")
    .eq("scene_id", sceneId)
    .maybeSingle();
  if (error) return null; // table missing / no access — fall back to blob
  return (data?.state as string | undefined) ?? null;
}

/**
 * Persist a full-state Y.Doc snapshot for a scene. Last-write-wins is correct:
 * any client's snapshot is convergent, so applying any of them yields the merged
 * document. The scenes JSONB row remains the durable source of truth.
 */
export async function saveSceneCrdt(sceneId: string, state: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase
    .from("scene_crdt")
    .upsert(
      { scene_id: sceneId, state, updated_at: new Date().toISOString() },
      { onConflict: "scene_id" },
    );
}
