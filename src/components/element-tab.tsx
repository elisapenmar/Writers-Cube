"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { StoryItem } from "@/server/story-element-crud";

/** Tell the editor's Smart Text registry to re-read after a name change. */
function notifyChanged() {
  window.dispatchEvent(new Event("wc:story-elements-changed"));
}

type ElementTabProps = {
  noun: string; // singular, lowercase: "place" / "item"
  emptyHint: string;
  load: () => Promise<StoryItem[]>;
  create: () => Promise<StoryItem>;
  update: (
    id: string,
    patch: { name?: string; category?: string | null; description?: string },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  focusId: string | null;
  clearFocus: () => void;
};

/**
 * Generic Story Bible tab for the simple element types (places, items): an
 * editable list of cards with name, category, and notes. Powers the Smart Text
 * hyperlink target — opening a card here is what a ⌘/Ctrl-click in the prose does.
 */
export function ElementTab({
  noun,
  emptyHint,
  load,
  create,
  update,
  remove,
  focusId,
  clearFocus,
}: ElementTabProps) {
  const [rows, setRows] = useState<StoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusId || rows === null) return;
    const el = document.getElementById(`wc-el-${noun}-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusId);
      setTimeout(() => setHighlightId(null), 2200);
    }
    clearFocus();
  }, [focusId, rows, noun, clearFocus]);

  async function reload() {
    try {
      setRows(await load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  function add() {
    startTransition(async () => {
      try {
        const created = await create();
        setRows((prev) => [...(prev ?? []), created]);
        notifyChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  function patchLocal(id: string, patch: Partial<StoryItem>) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  if (rows === null && !error) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading {noun}s…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <div className="text-[var(--wc-faint)]">
          {(rows?.length ?? 0)} {noun}
          {(rows?.length ?? 0) === 1 ? "" : "s"}
        </div>
        <button
          onClick={add}
          disabled={pending}
          className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}
        {(rows ?? []).length === 0 && !error ? (
          <p className="text-sm text-[var(--wc-faint)]">{emptyHint}</p>
        ) : (
          (rows ?? []).map((r) => (
            <div
              key={r.id}
              id={`wc-el-${noun}-${r.id}`}
              className={
                highlightId === r.id
                  ? "rounded-md ring-2 ring-[var(--wc-slate)] ring-offset-1 transition"
                  : "transition"
              }
            >
              <ElementCard
                row={r}
                onPatch={(patch) => patchLocal(r.id, patch)}
                onRemoved={() => setRows((prev) => (prev ?? []).filter((x) => x.id !== r.id))}
                onError={setError}
                update={update}
                remove={remove}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ElementCard({
  row,
  onPatch,
  onRemoved,
  onError,
  update,
  remove,
}: {
  row: StoryItem;
  onPatch: (patch: Partial<StoryItem>) => void;
  onRemoved: () => void;
  onError: (msg: string) => void;
  update: ElementTabProps["update"];
  remove: ElementTabProps["remove"];
}) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category ?? "");
  const [description, setDescription] = useState(row.description);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(row.name);
    setCategory(row.category ?? "");
    setDescription(row.description);
  }, [row.id, row.name, row.category, row.description]);

  function schedule(patch: { name?: string; category?: string | null; description?: string }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await update(row.id, patch);
        onPatch(patch as Partial<StoryItem>);
        if (patch.name !== undefined) {
          window.dispatchEvent(new Event("wc:story-elements-changed"));
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${row.name}"?`)) return;
    try {
      await remove(row.id);
      onRemoved();
      window.dispatchEvent(new Event("wc:story-elements-changed"));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 w-4 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          title={expanded ? "Collapse" : "Expand details"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== row.name) schedule({ name });
          }}
          placeholder="Name"
          className="flex-1 bg-transparent border-0 outline-none font-serif text-base text-[var(--wc-ink)] px-0"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() => {
            if (category !== (row.category ?? "")) schedule({ category: category || null });
          }}
          placeholder="category"
          className="w-32 bg-transparent border-0 outline-none text-xs text-[var(--wc-faint)] px-0 text-right"
        />
        <button
          onClick={handleDelete}
          className="text-xs text-[var(--wc-faint)] hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>

      {expanded ? (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== row.description) schedule({ description });
          }}
          rows={Math.max(3, description.split("\n").length + 1)}
          className="w-full mt-2 bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1.5 text-sm font-serif leading-relaxed outline-none focus:border-[var(--wc-border-strong)]"
          placeholder="Notes, details, history…"
        />
      ) : (
        <div
          onClick={() => setExpanded(true)}
          className="mt-1 cursor-pointer text-sm text-[var(--wc-muted)] font-serif leading-snug hover:bg-[var(--wc-canvas)] rounded px-1 -mx-1"
        >
          {description.trim() ? (
            <p className="line-clamp-2">{description.trim()}</p>
          ) : (
            <span className="italic text-[var(--wc-faint)]">Click to add notes</span>
          )}
        </div>
      )}

      {saving && <div className="text-[10px] text-[var(--wc-faint)] mt-1">Saving…</div>}
    </div>
  );
}
