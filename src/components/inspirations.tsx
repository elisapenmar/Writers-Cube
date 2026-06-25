"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  createInspiration,
  updateInspiration,
  deleteInspiration,
  type Inspiration,
} from "@/server/inspirations";

export function Inspirations({
  initial,
  limit,
}: {
  initial: Inspiration[];
  limit?: number;
}) {
  const [items, setItems] = useState<Inspiration[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      try {
        const i = await createInspiration();
        setItems((prev) => [i, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add");
      }
    });
  }

  function removeLocal(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const visible = limit ? items.slice(0, limit) : items;
  const hasMore = limit !== undefined && items.length > limit;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
            <span className="wc-facet" aria-hidden />
            Inspiration
          </h2>
          <p className="text-xs text-[var(--wc-faint)]">
            Lines and passages from what you read, kept here to spark your own.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasMore && (
            <Link href="/app/inspirations" className="text-xs text-[var(--wc-slate)] hover:underline">
              View all
            </Link>
          )}
          <button
            onClick={add}
            disabled={pending}
            className="shrink-0 rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105 disabled:opacity-50"
            style={{ background: "var(--wc-sage)" }}
          >
            + New inspiration
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--wc-muted)] rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-6">
          Nothing here yet. Paste a line that stopped you: a sentence, an image,
          a turn of phrase. Note where it came from.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((i) => (
            <InspirationCard
              key={i.id}
              item={i}
              onDeleted={() => removeLocal(i.id)}
              onError={setError}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InspirationCard({
  item,
  onDeleted,
  onError,
}: {
  item: Inspiration;
  onDeleted: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [source, setSource] = useState(item.source);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(patch: { title?: string; body?: string; source?: string }) {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      try {
        await updateInspiration(item.id, patch);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  async function remove() {
    if (!confirm("Delete this inspiration?")) return;
    try {
      await deleteInspiration(item.id);
      onDeleted();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="wc-card p-3 flex flex-col group">
      <div className="flex items-start gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule({ title: e.target.value });
          }}
          placeholder="Label (optional)…"
          className="flex-1 bg-transparent font-serif text-base text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)]"
        />
        <button
          onClick={remove}
          className="text-[var(--wc-faint)] hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          schedule({ body: e.target.value });
        }}
        placeholder="Paste or type the passage that inspired you…"
        rows={4}
        className="mt-1 flex-1 resize-none bg-transparent text-sm text-[var(--wc-muted)] leading-relaxed outline-none placeholder:text-[var(--wc-faint)]"
      />
      <input
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          schedule({ source: e.target.value });
        }}
        placeholder="Source (book, author, link)…"
        className="mt-1 w-full bg-transparent text-xs italic text-[var(--wc-faint)] outline-none placeholder:text-[var(--wc-faint)]"
      />
      <div className="h-3 text-[10px] text-[var(--wc-faint)]">{saving ? "Saving…" : ""}</div>
    </div>
  );
}
