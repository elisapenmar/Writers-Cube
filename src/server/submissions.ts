"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";

export type SubmissionStatus =
  | "Submitted"
  | "Accepted"
  | "Rejected"
  | "Withdrawn";

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "Submitted",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

export type Submission = {
  id: string;
  market: string;
  status: SubmissionStatus;
  sent_at: string | null; // YYYY-MM-DD
  response_at: string | null; // YYYY-MM-DD
  notes: string;
  updated_at: string;
};

/** Logline / theme / word-target read from the project, surfaced in the panel.
 *  `word_goal` reuses the existing per-project target (migration 0028). */
export type StoryMeta = {
  logline: string;
  theme: string;
  word_goal: number | null;
};

const COLS = "id, market, status, sent_at, response_at, notes, updated_at";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function missingTableError(): string {
  return "The 'submissions' table is missing in Supabase. Run supabase/migrations/0040_submissions.sql.";
}

function isMissingTable(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("submissions") && (m.includes("relation") || m.includes("does not exist"));
}

function coerceStatus(value: unknown): SubmissionStatus {
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus)
    ? (value as SubmissionStatus)
    : "Submitted";
}

function normalizeRow(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    market: (row.market as string) ?? "",
    status: coerceStatus(row.status),
    sent_at: (row.sent_at as string | null) ?? null,
    response_at: (row.response_at as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    updated_at: row.updated_at as string,
  };
}

export async function listSubmissions(): Promise<Submission[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("submissions")
    .select(COLS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function createSubmission(): Promise<Submission> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      user_id: user.id,
      project_id: projectId,
      market: "New market",
      status: "Submitted",
      sent_at: today,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(missingTableError());
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return normalizeRow(data as Record<string, unknown>);
}

export async function updateSubmission(
  id: string,
  patch: {
    market?: string;
    status?: SubmissionStatus;
    sent_at?: string | null;
    response_at?: string | null;
    notes?: string;
  },
): Promise<void> {
  const { supabase, user } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.market === "string") {
    update.market = patch.market.trim().slice(0, 200) || "New market";
  }
  if (patch.status !== undefined) {
    update.status = coerceStatus(patch.status);
  }
  if (patch.sent_at !== undefined) {
    update.sent_at = patch.sent_at || null;
  }
  if (patch.response_at !== undefined) {
    update.response_at = patch.response_at || null;
  }
  if (typeof patch.notes === "string") {
    update.notes = patch.notes;
  }
  const { error } = await supabase
    .from("submissions")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingTable(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

export async function deleteSubmission(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingTable(error)) throw new Error(missingTableError());
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

// ---- Story metadata (logline / theme / word target) ----

function isMissingMeta(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    (m.includes("logline") || m.includes("theme")) &&
    (m.includes("column") || m.includes("does not exist"))
  );
}

const META_REMINDER =
  "The 'logline' / 'theme' columns are missing on projects. Run supabase/migrations/0040_submissions.sql.";

export async function getStoryMeta(): Promise<StoryMeta> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return { logline: "", theme: "", word_goal: null };
  const { data, error } = await supabase
    .from("projects")
    .select("logline, theme, word_goal")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (isMissingMeta(error)) throw new Error(META_REMINDER);
    throw new Error(error.message);
  }
  return {
    logline: (data?.logline as string | null) ?? "",
    theme: (data?.theme as string | null) ?? "",
    word_goal: (data?.word_goal as number | null) ?? null,
  };
}

export async function updateStoryMeta(patch: {
  logline?: string;
  theme?: string;
  word_goal?: number | null;
}): Promise<void> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.logline !== undefined) {
    update.logline = patch.logline.trim().slice(0, 500) || null;
  }
  if (patch.theme !== undefined) {
    update.theme = patch.theme.trim().slice(0, 500) || null;
  }
  if (patch.word_goal !== undefined) {
    update.word_goal = patch.word_goal && patch.word_goal > 0 ? Math.round(patch.word_goal) : null;
  }
  const { error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingMeta(error)) throw new Error(META_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app", "layout");
}
