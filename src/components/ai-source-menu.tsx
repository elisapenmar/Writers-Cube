"use client";

import { useState } from "react";
import { AiDiamond } from "@/components/icons";

export type AiSource = { key: string; label: string; hint?: string };

/** A dropdown for an AI action that has multiple sources (notes / brainstorm /
 *  manuscript). Always carries the AI sparkle. */
export function AiSourceMenu({
  label,
  options,
  onSelect,
  busy = false,
  disabled = false,
}: {
  label: string;
  options: AiSource[];
  onSelect: (key: string) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy || disabled}
        className="flex items-center gap-1 rounded-md border border-[var(--wc-border-strong)] px-2.5 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
      >
        <AiDiamond className="text-[var(--wc-slate)]" size={13} />
        {busy ? "Working…" : label}
        <span className="text-[var(--wc-faint)]">▾</span>
      </button>
      {open && !busy && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  setOpen(false);
                  onSelect(o.key);
                }}
                className="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left hover:bg-[var(--wc-canvas)]"
              >
                <AiDiamond className="mt-0.5 text-[var(--wc-slate)]" size={12} />
                <span>
                  <span className="block text-xs text-[var(--wc-ink)]">{o.label}</span>
                  {o.hint && <span className="block text-[10px] text-[var(--wc-faint)]">{o.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
