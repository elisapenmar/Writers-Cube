"use client";

import type { EditorView } from "@/store/editor-view-store";

const ZOOMS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2];

/** Page-zoom dropdown for the paged view. Renders nothing in pageless mode. */
export function ZoomSelect({ view }: { view: EditorView }) {
  if (view.pageFormat !== "paged") return null;
  return (
    <select
      value={view.pageZoom}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => view.setPageZoom(Number(e.target.value))}
      title="Page zoom"
      className="h-7 shrink-0 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 text-xs text-[var(--wc-ink)] focus:outline-none"
    >
      {ZOOMS.map((z) => (
        <option key={z} value={z}>
          {Math.round(z * 100)}%
        </option>
      ))}
    </select>
  );
}
