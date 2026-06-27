"use client";

import { useState } from "react";
import type { EditorView } from "@/store/editor-view-store";
import { SpellingControls } from "@/components/spelling-controls";

/** Paragraph spacing · margins · spelling — document-level view controls.
 *  (Line spacing and columns live on the toolbar as their own buttons.) */
export function EditorViewOptions({
  view,
  iconOnly = false,
}: {
  view: EditorView;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const v = view;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={
          iconOnly
            ? "shrink-0 grid place-items-center h-7 w-7 rounded text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
            : "rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        }
        title="Page setup: paragraph spacing & margins"
      >
        {iconOnly ? <PageIcon /> : "▤ Page setup"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-60 rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-2 text-sm shadow-[var(--wc-shadow-md)]">
            <Group label="Paragraph spacing">
              <label className="flex items-center gap-2 text-xs text-[var(--wc-muted)]">
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

            <Group label="Margins">
              <p className="text-[11px] text-[var(--wc-muted)]">
                In Paged view, drag the markers on the ruler above the page to set
                the left and right margins.
              </p>
            </Group>

            <Group label="Spelling">
              <SpellingControls />
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

function PageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
