"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadBackupToDrive } from "@/server/drive";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type AccountBackup = {
  app: "writers-cube";
  version: number;
  exported_at: string;
  user: { id: string; email: string | null };
  projects: unknown[];
};

/** Gather the user's entire account into one portable JSON object. */
export async function buildAccountBackup(): Promise<AccountBackup> {
  const { supabase, user } = await requireUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const out: unknown[] = [];
  for (const p of projects ?? []) {
    const projectId = p.id as string;
    const { data: chapters } = await supabase
      .from("chapters")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    const chapterIds = (chapters ?? []).map((c) => c.id);
    const { data: scenes } = chapterIds.length
      ? await supabase.from("scenes").select("*").in("chapter_id", chapterIds)
      : { data: [] as Record<string, unknown>[] };
    const { data: loose } = await supabase
      .from("loose_scenes")
      .select("*")
      .eq("project_id", projectId);
    const { data: exercises } = await supabase
      .from("prompt_exercises")
      .select("*")
      .eq("project_id", projectId);

    out.push({
      ...p,
      chapters: (chapters ?? []).map((c) => ({
        ...c,
        scenes: (scenes ?? []).filter((s) => s.chapter_id === c.id),
      })),
      loose_scenes: loose ?? [],
      exercises: exercises ?? [],
    });
  }

  return {
    app: "writers-cube",
    version: 1,
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null },
    projects: out,
  };
}

function backupFilename(): string {
  return `writers-cube-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Push a full backup to the user's Google Drive (if connected). */
export async function backupToDrive(): Promise<{ ok: boolean; reason?: string }> {
  const { supabase, user } = await requireUser();
  const { data: cred } = await supabase
    .from("google_credentials")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!cred?.access_token) return { ok: false, reason: "drive-not-connected" };

  try {
    const bundle = await buildAccountBackup();
    await uploadBackupToDrive(backupFilename(), JSON.stringify(bundle, null, 2));
    await supabase
      .from("google_credentials")
      .update({ last_backup_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "upload-failed" };
  }
}

/**
 * Fire-and-forget daily off-site backup: runs when the user is active and the
 * last Drive backup is older than 24h. No-op if Drive isn't connected.
 */
export async function autoBackupIfStale(): Promise<{ status: string }> {
  const { supabase, user } = await requireUser();
  const { data: cred } = await supabase
    .from("google_credentials")
    .select("access_token, last_backup_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!cred?.access_token) return { status: "no-drive" };
  const last = cred.last_backup_at ? new Date(cred.last_backup_at as string).getTime() : 0;
  if (Date.now() - last < 24 * 60 * 60 * 1000) return { status: "recent" };

  const res = await backupToDrive();
  return { status: res.ok ? "backed-up" : `skipped:${res.reason}` };
}
