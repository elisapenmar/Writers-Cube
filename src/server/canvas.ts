"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CanvasItem = {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text content for text items; data URL for image items. */
  content: string;
};

export type CanvasState = { items: CanvasItem[] };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function isMissingColumn(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("canvas") &&
    (m.includes("column") || m.includes("does not exist"))
  );
}
const MIGRATION_REMINDER =
  "The 'canvas' column is missing on projects. Run: alter table projects add column if not exists canvas jsonb not null default '{\"items\":[]}'::jsonb;";

export async function getCanvas(): Promise<CanvasState> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("canvas")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  const raw = (data?.canvas as CanvasState | null) ?? { items: [] };
  return { items: Array.isArray(raw.items) ? raw.items : [] };
}

export async function saveCanvas(state: CanvasState): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!project) throw new Error("No project found");
  const { error } = await supabase
    .from("projects")
    .update({ canvas: state, updated_at: new Date().toISOString() })
    .eq("id", project.id);
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
