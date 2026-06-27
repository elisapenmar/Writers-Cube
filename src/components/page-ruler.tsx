"use client";

import { useRef } from "react";
import type { EditorView } from "@/store/editor-view-store";

const PAGE_IN = 8.5;
const MIN_MARGIN = 0.25;
const MIN_CONTENT = 1; // keep at least 1in of text width

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function snap(n: number) {
  return Math.round(n / 0.05) * 0.05;
}

/**
 * Google-Docs-style horizontal ruler shown above the paged sheet. Drag the left
 * and right markers to set the page margins (in inches), persisted on the view.
 * The ruler is exactly the page width (8.5in) so marker positions map to inches;
 * pointer math reads the live rect, so it stays correct under page zoom.
 */
export function PageRuler({ view }: { view: EditorView }) {
  const rulerRef = useRef<HTMLDivElement>(null);

  function startDrag(which: "l" | "r", e: React.MouseEvent) {
    e.preventDefault();
    const ruler = rulerRef.current;
    if (!ruler) return;
    const onMove = (ev: MouseEvent) => {
      const rect = ruler.getBoundingClientRect();
      const inches = ((ev.clientX - rect.left) / rect.width) * PAGE_IN;
      if (which === "l") {
        view.setMarginLeft(snap(clamp(inches, MIN_MARGIN, PAGE_IN - view.marginRight - MIN_CONTENT)));
      } else {
        view.setMarginRight(snap(clamp(PAGE_IN - inches, MIN_MARGIN, PAGE_IN - view.marginLeft - MIN_CONTENT)));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const ml = view.marginLeft;
  const mr = view.marginRight;
  const labels = Array.from({ length: Math.floor(PAGE_IN) }, (_, i) => i + 1);

  return (
    <div ref={rulerRef} className="wc-ruler" aria-label="Page margins ruler">
      <div className="wc-ruler-track" />
      <div
        className="wc-ruler-page"
        style={{ left: `${ml}in`, width: `${PAGE_IN - ml - mr}in` }}
      />
      {labels.map((n) => (
        <span
          key={n}
          className="absolute top-1 text-[8px] leading-none text-[var(--wc-faint)] -translate-x-1/2"
          style={{ left: `${n}in` }}
        >
          {n}
        </span>
      ))}
      <div
        className="wc-ruler-marker"
        style={{ left: `${ml}in` }}
        onMouseDown={(e) => startDrag("l", e)}
        title={`Left margin: ${ml.toFixed(2)}in`}
        role="slider"
        aria-label="Left margin"
        aria-valuenow={ml}
      >
        <MarkerIcon />
      </div>
      <div
        className="wc-ruler-marker"
        style={{ left: `${PAGE_IN - mr}in` }}
        onMouseDown={(e) => startDrag("r", e)}
        title={`Right margin: ${mr.toFixed(2)}in`}
        role="slider"
        aria-label="Right margin"
        aria-valuenow={mr}
      >
        <MarkerIcon />
      </div>
    </div>
  );
}

function MarkerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M2 2h10v5l-5 5-5-5z" />
    </svg>
  );
}
