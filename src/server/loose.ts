"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LooseScene = {
  id: string;
  project_id: string;
  title: string;
  content: unknown;
  word_count: number;
  updated_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function isMissingTable(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("loose_scenes") &&
    (m.includes("relation") || m.includes("does not exist") || m.includes("schema cache"))
  );
}
const MIGRATION_REMINDER =
  "The 'loose_scenes' table is missing. Run supabase/migrations/0013_loose_scenes.sql.";

export async function listLooseScenes(projectId: string): Promise<LooseScene[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("loose_scenes")
    .select("id, project_id, title, content, word_count, updated_at")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data ?? []) as LooseScene[];
}

export async function getLooseScene(id: string): Promise<LooseScene | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("loose_scenes")
    .select("id, project_id, title, content, word_count, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data as LooseScene) ?? null;
}

/** Create a loose scene in the given project and open it. */
export async function createLooseScene(projectId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("loose_scenes")
    .insert({
      user_id: user.id,
      project_id: projectId,
      title: "Untitled",
      content: { type: "doc", content: [{ type: "paragraph" }] },
    })
    .select("id")
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app", "layout");
  redirect(`/app/loose/${data.id}`);
}

function countWords(doc: unknown): number {
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

export async function updateLooseSceneContent(
  id: string,
  content: unknown,
): Promise<{ word_count: number; savedAt: string }> {
  const { supabase } = await requireUser();
  const word_count = countWords(content);
  const savedAt = new Date().toISOString();
  const { error } = await supabase
    .from("loose_scenes")
    .update({ content, word_count, updated_at: savedAt })
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return { word_count, savedAt };
}

export async function renameLooseScene(id: string, title: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("loose_scenes")
    .update({ title: title.trim().slice(0, 200) || "Untitled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app", "layout");
}

export async function deleteLooseScene(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("loose_scenes").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app", "layout");
}
