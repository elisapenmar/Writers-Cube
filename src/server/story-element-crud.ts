// Shared CRUD for the simple Story Bible element tables (places, items). These
// mirror the core of characters but without the AI pull/cite/grid extras.
// Not a "use server" module itself — the thin per-table wrappers (places.ts,
// items.ts) expose these as server actions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";

export type StoryItem = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  position: number;
  updated_at: string;
};

const COLS = "id, name, category, description, position, updated_at";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function missingTableError(table: string): string {
  return `The '${table}' table is missing in Supabase. Run the matching SQL in supabase/migrations/.`;
}

function isMissingTable(table: string, err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes(table) && (m.includes("relation") || m.includes("does not exist"));
}

export async function listElements(table: string): Promise<StoryItem[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from(table)
    .select(COLS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
  return (data ?? []) as StoryItem[];
}

export async function createElement(
  table: string,
  defaultName: string,
): Promise<StoryItem> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const { data: last } = await supabase
    .from(table)
    .select("position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from(table)
    .insert({
      user_id: user.id,
      project_id: projectId,
      name: defaultName,
      description: "",
      position,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as StoryItem;
}

export async function updateElement(
  table: string,
  id: string,
  patch: { name?: string; category?: string | null; description?: string },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.name === "string") {
    update.name = patch.name.trim().slice(0, 200) || "Unnamed";
  }
  if (patch.category !== undefined) {
    update.category = patch.category ? patch.category.trim().slice(0, 120) : null;
  }
  if (typeof patch.description === "string") {
    update.description = patch.description;
  }
  const { error } = await supabase.from(table).update(update).eq("id", id);
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
}

export async function deleteElement(table: string, id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
  revalidatePath("/app");
}
