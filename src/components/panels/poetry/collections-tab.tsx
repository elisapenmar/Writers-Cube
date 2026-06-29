"use client";

import { useEffect, useState } from "react";
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  assignSceneToCollection,
  listPoemsWithCollection,
} from "@/server/collections";
import type { Collection } from "@/lib/types";

type Poem = { id: string; title: string; collection_id: string | null };

export function CollectionsTab() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [cols, ps] = await Promise.all([listCollections(), listPoemsWithCollection()]);
      setCollections(cols);
      setPoems(ps);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Load on mount; setState happens only after the awaited fetch, never
    // synchronously in the effect body.
    void (async () => {
      await refresh();
    })();
  }, []);

  async function add() {
    setBusy(true);
    try {
      await createCollection();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string, title: string) {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await updateCollection(id, { title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteCollection(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(sceneId: string, collectionId: string | null) {
    setPoems((prev) =>
      prev.map((p) => (p.id === sceneId ? { ...p, collection_id: collectionId } : p)),
    );
    try {
      await assignSceneToCollection(sceneId, collectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not file poem");
      void refresh();
    }
  }

  if (loading) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)]">
        Loading collections…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-sm text-[var(--wc-ink)]">Collections</h3>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-md bg-[var(--wc-slate)] px-2.5 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
        >
          + New collection
        </button>
      </div>

      {collections.length === 0 ? (
        <p className="mb-4 px-1 text-xs text-[var(--wc-faint)]">
          No collections yet. Make one to gather poems into a chapbook.
        </p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {collections.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-[var(--wc-border)] px-2.5 py-1.5"
            >
              <input
                defaultValue={c.title}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== c.title) void rename(c.id, next);
                }}
                className="flex-1 bg-transparent text-sm text-[var(--wc-ink)] focus:outline-none"
              />
              <span className="text-[11px] text-[var(--wc-faint)] tabular-nums">
                {poems.filter((p) => p.collection_id === c.id).length}
              </span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={busy}
                className="text-[var(--wc-faint)] hover:text-red-600"
                title="Delete collection (its poems stay, just unfiled)"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 font-serif text-sm text-[var(--wc-ink)]">Poems</h3>
      {poems.length === 0 ? (
        <p className="px-1 text-xs text-[var(--wc-faint)]">No poems in this project yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {poems.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm text-[var(--wc-ink)]" title={p.title}>
                {p.title}
              </span>
              <select
                value={p.collection_id ?? ""}
                onChange={(e) => void assign(p.id, e.target.value || null)}
                disabled={collections.length === 0}
                className="rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 py-1 text-xs text-[var(--wc-ink)] focus:outline-none disabled:opacity-50"
              >
                <option value="">Unfiled</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
