"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Inspiration = {
  id: string;
  title: string;
  body: string;
  source: string;
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
    m.includes("inspirations") &&
    (m.includes("relation") || m.includes("does not exist") || m.includes("schema cache"))
  );
}
const MIGRATION_REMINDER =
  "The 'inspirations' table is missing. Run supabase/migrations/0025_inspirations.sql.";

export async function listInspirations(): Promise<Inspiration[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("inspirations")
    .select("id, title, body, source, created_at, updated_at")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data ?? []) as Inspiration[];
}

export async function createInspiration(): Promise<Inspiration> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("inspirations")
    .insert({ user_id: user.id, title: "", body: "", source: "" })
    .select("id, title, body, source, created_at, updated_at")
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as Inspiration;
}

export async function updateInspiration(
  id: string,
  patch: { title?: string; body?: string; source?: string },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === "string") update.title = patch.title.slice(0, 200);
  if (typeof patch.body === "string") update.body = patch.body;
  if (typeof patch.source === "string") update.source = patch.source.slice(0, 300);
  const { error } = await supabase
    .from("inspirations")
    .update(update)
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
}

export async function deleteInspiration(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("inspirations").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
