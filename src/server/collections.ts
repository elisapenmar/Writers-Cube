"use server";

// Server actions for poetry collections (chapbooks): group a poetry project's
// poems under named collections, and file individual poems into one. Mirrors the
// shape of the simple Story-Bible element CRUD (places/items), scoped to the
// active project via the same cookie-based resolver.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import type { Collection } from "@/lib/types";

const COLS = "id, project_id, title, description, position, updated_at";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function missingTableError(): string {
  return "The 'collections' table is missing in Supabase. Run supabase/migrations/0041_poetry_collection.sql.";
}

function isMissingCollections(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("collections") && (m.includes("relation") || m.includes("does not exist"));
}

export async function listCollections(): Promise<Collection[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("collections")
    .select(COLS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    if (isMissingCollections(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  return (data ?? []) as Collection[];
}

export async function createCollection(title?: string): Promise<Collection> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const { data: last } = await supabase
    .from("collections")
    .select("position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      project_id: projectId,
      title: (title?.trim() || "New collection").slice(0, 200),
      description: "",
      position,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    if (isMissingCollections(error)) throw new Error(missingTableError());
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as Collection;
}

export async function updateCollection(
  id: string,
  patch: { title?: string; description?: string },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === "string") {
    update.title = patch.title.trim().slice(0, 200) || "Untitled collection";
  }
  if (typeof patch.description === "string") {
    update.description = patch.description;
  }
  const { error } = await supabase.from("collections").update(update).eq("id", id);
  if (error) {
    if (isMissingCollections(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

export async function deleteCollection(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) {
    if (isMissingCollections(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

/** File a poem (scene) into a collection, or pass null to unfile it. */
export async function assignSceneToCollection(
  sceneId: string,
  collectionId: string | null,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("scenes")
    .update({ collection_id: collectionId })
    .eq("id", sceneId);
  if (error) throw new Error(error.message);
  revalidatePath("/app");
}

/** Poems in the active project with their current collection membership, so the
 *  sidebar can show what's filed where. */
export async function listPoemsWithCollection(): Promise<
  { id: string; title: string; collection_id: string | null }[]
> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("scenes")
    .select("id, title, collection_id, position, chapters!inner(project_id)")
    .eq("chapters.project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    collection_id: (row.collection_id as string | null) ?? null,
  }));
}
