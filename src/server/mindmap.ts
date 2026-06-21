"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import type { MindMapNode } from "@/server/brainstorm";

export type SavedPosition = { x: number; y: number };
export type SavedMindMap = {
  nodes: MindMapNode[];
  positions: Record<string, SavedPosition>;
};

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
    m.includes("mind_map") &&
    (m.includes("column") || m.includes("does not exist"))
  );
}
const MIGRATION_REMINDER =
  "The 'mind_map' column is missing on projects. Run: alter table projects add column if not exists mind_map jsonb not null default '{\"nodes\":[],\"positions\":{}}'::jsonb;";

const EMPTY: SavedMindMap = { nodes: [], positions: {} };

async function getProjectId(): Promise<{ projectId: string }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  return { projectId };
}

export async function getMindMap(): Promise<SavedMindMap> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return EMPTY;
  const { data, error } = await supabase
    .from("projects")
    .select("mind_map")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  const raw = (data?.mind_map as SavedMindMap | null) ?? EMPTY;
  return {
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    positions: raw.positions && typeof raw.positions === "object" ? raw.positions : {},
  };
}

export async function saveMindMap(state: SavedMindMap): Promise<void> {
  const { supabase } = await requireUser();
  const { projectId } = await getProjectId();
  const clean: SavedMindMap = {
    nodes: state.nodes.map((n) => ({
      id: String(n.id),
      label: String(n.label),
      parent: n.parent ? String(n.parent) : null,
    })),
    positions: state.positions ?? {},
  };
  const { error } = await supabase
    .from("projects")
    .update({ mind_map: clean, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
