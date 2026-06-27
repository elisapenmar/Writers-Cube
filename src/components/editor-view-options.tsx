"use client";

import { useState } from "react";
import type { EditorView } from "@/store/editor-view-store";

const SPACINGS: { label: string; value: number }[] = [
  { label: "Single", value: 1 },
  { label: "1.15", value: 1.15 },
  { label: "1.5", value: 1.5 },
  { label: "Double", value: 2 },
];

/** Page format · line spacing · columns — the document-level view controls. */
export function EditorViewOptions({ view }: { view: EditorView }) {
  const [open, setOpen] = useState(false);
  const v = view;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        title="Page format, line spacing & columns"
      >
        ▤ Page setup
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-60 rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-2 text-sm shadow-[var(--wc-shadow-md)]">
            <Group label="Format">
              <Seg
                options={[
                  { label: "Pageless", value: "pageless" },
                  { label: "Paged", value: "paged" },
                ]}
                value={v.pageFormat}
                onChange={(val) => v.setPageFormat(val as "pageless" | "paged")}
              />
            </Group>

            <Group label="Line spacing">
              <div className="grid grid-cols-4 gap-1">
                {SPACINGS.map((sp) => (
                  <button
                    key={sp.value}
                    onClick={() => v.setLineSpacing(sp.value)}
                    className={`rounded px-1.5 py-1 text-xs ${
                      v.lineSpacing === sp.value
                        ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
                        : "text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
              <label className="mt-1.5 flex items-center gap-2 text-xs text-[var(--wc-muted)]">
                <input
                  type="checkbox"
                  checked={v.spaceBefore}
                  onChange={(e) => v.setSpaceBefore(e.target.checked)}
                />
                Add space before paragraph
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--wc-muted)]">
                <input
                  type="checkbox"
                  checked={v.spaceAfter}
                  onChange={(e) => v.setSpaceAfter(e.target.checked)}
                />
                Add space after paragraph
              </label>
            </Group>

            <Group label="Columns">
              <Seg
                options={[
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                ]}
                value={String(v.columns)}
                onChange={(val) => v.setColumns(Number(val))}
              />
            </Group>
          </div>
        </>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1.5 border-b border-[var(--wc-border)] last:border-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--wc-faint)]">{label}</div>
      {children}
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md border border-[var(--wc-border-strong)] overflow-hidden text-xs">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-1 ${i > 0 ? "border-l border-[var(--wc-border)]" : ""} ${
            value === o.value
              ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
              : "text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
