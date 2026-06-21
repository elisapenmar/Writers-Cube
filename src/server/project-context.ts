import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const ACTIVE_PROJECT_COOKIE = "wc_active_project";

/**
 * Resolve which project the per-project features (Story Bible, Organize, notes,
 * brainstorm, etc.) should read/write: the active-project cookie when it points
 * to one of the user's projects, otherwise the oldest non-archived project.
 */
export async function resolveProjectId(
  supabase: SupabaseServer,
  userId: string,
): Promise<string | null> {
  const store = await cookies();
  const cookieId = store.get(ACTIVE_PROJECT_COOKIE)?.value;
  if (cookieId) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("id", cookieId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}
