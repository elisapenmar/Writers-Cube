"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";

export type TimelineEvent = {
  id: string;
  title: string;
  when: string; // free-text time label ("Day 1", "Spring 1887", …)
  notes: string;
  // Optional links to a story moment (scene) and characters.
  scene?: { id: string; title: string } | null;
  characters?: { id: string; name: string }[];
};
export type TimelineLane = {
  id: string;
  name: string;
  color: string;
  events: TimelineEvent[];
};
export type TimelineState = { lanes: TimelineLane[] };

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
  return m.includes("timeline") && (m.includes("column") || m.includes("does not exist"));
}
const MIGRATION_REMINDER =
  "The 'timeline' column is missing on projects. Run: alter table projects add column if not exists timeline jsonb not null default '{\"lanes\":[]}'::jsonb;";

const EMPTY: TimelineState = { lanes: [] };

export async function getTimeline(): Promise<TimelineState> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return EMPTY;
  const { data, error } = await supabase
    .from("projects")
    .select("timeline")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  const raw = (data?.timeline as TimelineState | null) ?? EMPTY;
  return { lanes: Array.isArray(raw.lanes) ? raw.lanes : [] };
}

export async function saveTimeline(state: TimelineState): Promise<void> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const project = { id: projectId };
  const { error } = await supabase
    .from("projects")
    .update({ timeline: state, updated_at: new Date().toISOString() })
    .eq("id", project.id);
  if (error) {
    if (isMissingColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
