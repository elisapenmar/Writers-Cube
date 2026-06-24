"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StoryKernel = {
  id: string;
  title: string;
  body: string;
  content?: unknown | null;
  created_at: string;
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
    m.includes("story_kernels") &&
    (m.includes("relation") || m.includes("does not exist") || m.includes("schema cache"))
  );
}
const MIGRATION_REMINDER =
  "The 'story_kernels' table is missing. Run supabase/migrations/0012_story_kernels.sql.";

export async function listKernels(): Promise<StoryKernel[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("story_kernels")
    .select("id, title, body, created_at, updated_at")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data ?? []) as StoryKernel[];
}

export async function getKernel(id: string): Promise<StoryKernel | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("story_kernels")
    .select("id, title, body, content, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data as StoryKernel) ?? null;
}

export async function createKernel(): Promise<StoryKernel> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("story_kernels")
    .insert({ user_id: user.id, title: "", body: "" })
    .select("id, title, body, created_at, updated_at")
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as StoryKernel;
}

export async function updateKernel(
  id: string,
  patch: { title?: string; body?: string; content?: unknown },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === "string") update.title = patch.title.slice(0, 200);
  if (typeof patch.body === "string") update.body = patch.body;
  if (patch.content !== undefined) update.content = patch.content;
  const { error } = await supabase
    .from("story_kernels")
    .update(update)
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
}

export async function deleteKernel(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("story_kernels").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
