import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CAS_MAX_ATTEMPTS = 8;

export type CasContext = {
  /** The row as it exists in the DB right now, or null if it is missing. */
  current: Record<string, unknown> | null;
  /**
   * True when the row changed since the value the caller last saw (the `base`
   * token mismatched) OR on any retry after a lost compare-and-swap. Use this
   * to preserve the value we are about to overwrite (see content_conflicts).
   */
  conflicted: boolean;
};

/**
 * Optimistic-concurrency UPDATE keyed on the row's `updated_at` version token.
 *
 * This is the no-lost-updates guarantee: a write only lands on the exact row
 * state we just read (`UPDATE … WHERE id=? AND updated_at=<base>`). If another
 * writer committed in between, the conditional update touches 0 rows and we
 * re-read, re-resolve, and retry — so concurrent saves are serialized through
 * the same read-modify-write instead of blindly clobbering each other.
 *
 * `resolve` builds the patch to write (WITHOUT `updated_at`) and is where the
 * caller does write-safety snapshots and conflict preservation, using the
 * `current` row + `conflicted` flag.
 */
export async function casUpdate(
  supabase: Supabase,
  params: {
    table: string;
    id: string;
    /** The `updated_at` the caller last saw; null skips conflict detection. */
    base: string | null;
    /** Extra columns to read for the resolver (e.g. "content, word_count"). */
    selectCols?: string;
    resolve: (
      ctx: CasContext,
    ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  },
): Promise<{ updatedAt: string }> {
  const { table, id, base, selectCols, resolve } = params;
  const cols = selectCols ? `${selectCols}, updated_at` : "updated_at";

  for (let attempt = 1; attempt <= CAS_MAX_ATTEMPTS; attempt++) {
    const { data: current, error: readErr } = await supabase
      .from(table)
      .select(cols)
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const currentRow = (current as Record<string, unknown> | null) ?? null;
    const currentUpdatedAt = (currentRow?.updated_at as string) ?? null;
    // A conflict is when the row moved since the caller last saw it, or any
    // retry (which only happens because a concurrent writer beat us).
    const conflicted =
      attempt > 1 ||
      (base != null && currentUpdatedAt != null && currentUpdatedAt !== base);

    const patch = await resolve({ current: currentRow, conflicted });
    const newUpdatedAt = new Date().toISOString();

    let q = supabase
      .from(table)
      .update({ ...patch, updated_at: newUpdatedAt })
      .eq("id", id);
    q = currentUpdatedAt == null ? q.is("updated_at", null) : q.eq("updated_at", currentUpdatedAt);
    const { data: updated, error: writeErr } = await q.select("updated_at");
    if (writeErr) throw new Error(writeErr.message);

    if (updated && updated.length > 0) {
      return { updatedAt: (updated[0] as { updated_at: string }).updated_at };
    }
    // 0 rows: a concurrent writer committed between our read and write. Back off
    // (jittered) and retry — the next read re-resolves against their state.
    await new Promise((r) => setTimeout(r, 20 * attempt + Math.random() * 20));
  }
  throw new Error(`casUpdate(${table}): exceeded ${CAS_MAX_ATTEMPTS} attempts`);
}
