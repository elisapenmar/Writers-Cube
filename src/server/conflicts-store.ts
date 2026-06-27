import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CONFLICT_MAX = 80; // cap per entity so the table can't grow unbounded
const CONFLICT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // prune entries older than 14 days

/** Structural equality for Tiptap JSON / plain values (same serializer => stable). */
export function contentEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** A Tiptap doc with no text is "empty" — never worth preserving as a conflict. */
export function isEmptyDoc(doc: unknown): boolean {
  if (doc == null || doc === "") return true;
  if (typeof doc === "string") return doc.trim().length === 0;
  return countWords(doc) === 0;
}

function countWords(doc: unknown): number {
  if (typeof doc === "string") return doc.trim().split(/\s+/).filter(Boolean).length;
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Preserve the value a compare-and-swap is about to overwrite (the "loser" of a
 * same-row collision) so it is recoverable. Best-effort: never blocks a save.
 * Deduped against the most recent entry; capped and TTL-pruned per entity.
 */
export async function recordConflict(
  supabase: Supabase,
  userId: string,
  entityType: string,
  entityId: string,
  value: unknown,
): Promise<void> {
  try {
    if (isEmptyDoc(value)) return;
    // Dedupe: skip if the newest stored conflict for this entity is identical.
    const { data: last } = await supabase
      .from("content_conflicts")
      .select("value")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && contentEqual(last.value, value)) return;

    await supabase.from("content_conflicts").insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      value,
      word_count: countWords(value),
    });
    await pruneConflicts(supabase, entityType, entityId);
  } catch {
    // Conflict preservation is a safety net; never let it break the write.
  }
}

/** Delete entries older than the TTL and trim each entity to the newest N. */
async function pruneConflicts(
  supabase: Supabase,
  entityType: string,
  entityId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - CONFLICT_TTL_MS).toISOString();
  await supabase
    .from("content_conflicts")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .lt("created_at", cutoff);

  const { data: rows } = await supabase
    .from("content_conflicts")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (rows && rows.length > CONFLICT_MAX) {
    const stale = rows.slice(CONFLICT_MAX).map((r) => r.id as string);
    await supabase.from("content_conflicts").delete().in("id", stale);
  }
}
