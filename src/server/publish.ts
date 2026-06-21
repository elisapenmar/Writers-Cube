"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type PublishSettings,
  withDefaults,
} from "@/lib/publish-types";

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
  return m.includes("publish_settings") && (m.includes("column") || m.includes("schema cache"));
}

/** Load publish settings for a project (defaults merged in). */
export async function getPublishSettings(projectId: string): Promise<PublishSettings> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("publish_settings, title, author_name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) return withDefaults(null);
    throw new Error(error.message);
  }
  const stored = (data?.publish_settings as Partial<PublishSettings> | null) ?? null;
  const merged = withDefaults(stored);
  // Seed metadata from the project when not explicitly overridden.
  if (!merged.title && data?.title) merged.title = data.title as string;
  if (!merged.author && data?.author_name) merged.author = data.author_name as string;
  return merged;
}

export async function savePublishSettings(
  projectId: string,
  settings: PublishSettings,
): Promise<{ ok: true }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ publish_settings: settings })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingColumn(error)) {
      throw new Error(
        "The 'publish_settings' column is missing. Run supabase/migrations/0015_publish_settings.sql.",
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/app/publish");
  return { ok: true };
}
