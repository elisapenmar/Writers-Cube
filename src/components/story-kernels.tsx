"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createKernel,
  updateKernel,
  deleteKernel,
  type StoryKernel,
} from "@/server/kernels";

export function StoryKernels({
  initial,
  limit,
}: {
  initial: StoryKernel[];
  limit?: number;
}) {
  const [kernels, setKernels] = useState<StoryKernel[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      try {
        const k = await createKernel();
        setKernels((prev) => [k, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add");
      }
    });
  }

  function removeLocal(id: string) {
    setKernels((prev) => prev.filter((k) => k.id !== id));
  }

  const visible = limit ? kernels.slice(0, limit) : kernels;
  const hasMore = limit !== undefined && kernels.length > limit;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
            <span className="wc-facet" aria-hidden />
            Story kernels
          </h2>
          <p className="text-xs text-[var(--wc-faint)]">
            Half-formed ideas, parked here until they&apos;re ready to grow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasMore && (
            <Link href="/app/kernels" className="text-xs text-[var(--wc-slate)] hover:underline">
              View all
            </Link>
          )}
          <button
            onClick={add}
            disabled={pending}
            className="shrink-0 rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105 disabled:opacity-50"
            style={{ background: "var(--wc-plum)" }}
          >
            + New kernel
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

      {kernels.length === 0 ? (
        <p className="text-sm text-[var(--wc-muted)] rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-6">
          No kernels yet. Jot down a spark, a what-if, an image, a first line,
          before it slips away.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((k) => (
            <KernelCard
              key={k.id}
              kernel={k}
              onDeleted={() => removeLocal(k.id)}
              onError={setError}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function KernelCard({
  kernel,
  onDeleted,
  onError,
}: {
  kernel: StoryKernel;
  onDeleted: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(kernel.title);
  const [body, setBody] = useState(kernel.body);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(patch: { title?: string; body?: string }) {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      try {
        await updateKernel(kernel.id, patch);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  async function remove() {
    if (!confirm("Delete this kernel?")) return;
    try {
      await deleteKernel(kernel.id);
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
          placeholder="Working title…"
          className="flex-1 bg-transparent font-serif text-base text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)]"
        />
        <Link
          href={`/app/kernels/${kernel.id}`}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--wc-border-strong)] px-2 py-0.5 text-[11px] font-medium text-[var(--wc-slate)] hover:bg-[var(--wc-slate)] hover:text-[var(--wc-on-accent)] hover:border-[var(--wc-slate)] transition-colors"
          title="Open in the word processor"
        >
          ⤢ Open
        </Link>
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
        placeholder="The spark… a what-if, an image, a line of dialogue."
        rows={4}
        className="mt-1 flex-1 resize-none bg-transparent text-sm text-[var(--wc-muted)] leading-relaxed outline-none placeholder:text-[var(--wc-faint)]"
      />
      <div className="h-3 text-[10px] text-[var(--wc-faint)]">{saving ? "Saving…" : ""}</div>
    </div>
  );
}
