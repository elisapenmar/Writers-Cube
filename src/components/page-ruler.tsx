"use client";

import { useRef, useState } from "react";
import type { EditorView } from "@/store/editor-view-store";

const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const MIN_MARGIN = 0.25;
const MIN_CONTENT = 1; // keep at least 1in of text width/height

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function snap(n: number) {
  return Math.round(n / 0.05) * 0.05;
}

type Tier = "in" | "half" | "quarter" | "eighth";
type Tick = { pos: number; tier: Tier; label?: number; key: string };

/** Ticks every 1/8in counted inward from BOTH edges, so the inch numbers line up
 *  with their marks on each side and meet at the centre. Longer marks for inch >
 *  half > quarter > eighth. */
function ticksFor(pageLen: number): Tick[] {
  const half = Math.round(pageLen / 2 / 0.125); // 1/8 steps to the centre
  const center = pageLen / 2;
  const tierOf = (k: number): Tier =>
    k % 8 === 0 ? "in" : k % 8 === 4 ? "half" : k % 2 === 0 ? "quarter" : "eighth";
  const out: Tick[] = [];
  for (const fromRight of [false, true]) {
    for (let k = 0; k <= half; k++) {
      const d = k * 0.125;
      const pos = fromRight ? pageLen - d : d;
      if (fromRight && Math.abs(pos - center) < 0.0625) continue; // dedupe centre
      const tier = tierOf(k);
      out.push({ pos, tier, label: tier === "in" ? k / 8 : undefined, key: `${fromRight ? "r" : "l"}${k}` });
    }
  }
  return out;
}

const H_TICKS = ticksFor(PAGE_W_IN);
const V_TICKS = ticksFor(PAGE_H_IN);

/**
 * Horizontal ruler above the paged sheet. Each edge counts inches inward from 0,
 * meeting at the 4.25in centre. Drag a marker to set the left/right margin; a
 * readout shows the live distance from the edge. Pointer math reads the live rect
 * so it stays correct under page zoom.
 */
export function PageRuler({ view }: { view: EditorView }) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | "l" | "r">(null);

  function startDrag(which: "l" | "r", e: React.MouseEvent) {
    e.preventDefault();
    const ruler = rulerRef.current;
    if (!ruler) return;
    setDrag(which);
    const onMove = (ev: MouseEvent) => {
      const rect = ruler.getBoundingClientRect();
      const inches = ((ev.clientX - rect.left) / rect.width) * PAGE_W_IN;
      if (which === "l") {
        view.setMarginLeft(snap(clamp(inches, MIN_MARGIN, PAGE_W_IN - view.marginRight - MIN_CONTENT)));
      } else {
        view.setMarginRight(snap(clamp(PAGE_W_IN - inches, MIN_MARGIN, PAGE_W_IN - view.marginLeft - MIN_CONTENT)));
      }
    };
    const onUp = () => {
      setDrag(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const ml = view.marginLeft;
  const mr = view.marginRight;

  return (
    <div ref={rulerRef} className="wc-ruler" aria-label="Horizontal margins ruler">
      <div className="wc-ruler-page" style={{ left: `${ml}in`, right: `${mr}in` }} />
      {H_TICKS.map((t) => (
        <i key={t.key} className={`wc-tick wc-tick-${t.tier}`} style={{ left: `${t.pos}in` }} />
      ))}
      {H_TICKS.filter((t) => t.label !== undefined).map((t) => (
        <span key={`n${t.key}`} className="wc-ruler-num" style={{ left: `${t.pos}in` }}>
          {t.label}
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
        {drag === "l" && <span className="wc-ruler-readout">{ml.toFixed(2)}&Prime;</span>}
        <MarkerIcon />
      </div>
      <div
        className="wc-ruler-marker"
        style={{ left: `${PAGE_W_IN - mr}in` }}
        onMouseDown={(e) => startDrag("r", e)}
        title={`Right margin: ${mr.toFixed(2)}in`}
        role="slider"
        aria-label="Right margin"
        aria-valuenow={mr}
      >
        {drag === "r" && <span className="wc-ruler-readout">{mr.toFixed(2)}&Prime;</span>}
        <MarkerIcon />
      </div>
    </div>
  );
}

/**
 * Vertical ruler down the left of the paged sheet — same logic as the horizontal
 * one for the top/bottom margins (each edge counts from 0 to the 5.5in centre).
 */
export function PageRulerV({ view }: { view: EditorView }) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | "t" | "b">(null);

  function startDrag(which: "t" | "b", e: React.MouseEvent) {
    e.preventDefault();
    const ruler = rulerRef.current;
    if (!ruler) return;
    setDrag(which);
    const onMove = (ev: MouseEvent) => {
      const rect = ruler.getBoundingClientRect();
      const inches = ((ev.clientY - rect.top) / rect.height) * PAGE_H_IN;
      if (which === "t") {
        view.setMarginTop(snap(clamp(inches, MIN_MARGIN, PAGE_H_IN - view.marginBottom - MIN_CONTENT)));
      } else {
        view.setMarginBottom(snap(clamp(PAGE_H_IN - inches, MIN_MARGIN, PAGE_H_IN - view.marginTop - MIN_CONTENT)));
      }
    };
    const onUp = () => {
      setDrag(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const mt = view.marginTop;
  const mb = view.marginBottom;

  return (
    <div ref={rulerRef} className="wc-ruler-v" aria-label="Vertical margins ruler">
      <div className="wc-ruler-v-page" style={{ top: `${mt}in`, bottom: `${mb}in` }} />
      {V_TICKS.map((t) => (
        <i key={t.key} className={`wc-tick wc-tick-${t.tier}`} style={{ top: `${t.pos}in` }} />
      ))}
      {V_TICKS.filter((t) => t.label !== undefined).map((t) => (
        <span key={`n${t.key}`} className="wc-ruler-v-num" style={{ top: `${t.pos}in` }}>
          {t.label}
        </span>
      ))}
      <div
        className="wc-ruler-v-marker"
        style={{ top: `${mt}in` }}
        onMouseDown={(e) => startDrag("t", e)}
        title={`Top margin: ${mt.toFixed(2)}in`}
        role="slider"
        aria-label="Top margin"
        aria-valuenow={mt}
      >
        {drag === "t" && <span className="wc-ruler-readout-v">{mt.toFixed(2)}&Prime;</span>}
        <MarkerIcon vertical />
      </div>
      <div
        className="wc-ruler-v-marker"
        style={{ top: `${PAGE_H_IN - mb}in` }}
        onMouseDown={(e) => startDrag("b", e)}
        title={`Bottom margin: ${mb.toFixed(2)}in`}
        role="slider"
        aria-label="Bottom margin"
        aria-valuenow={mb}
      >
        {drag === "b" && <span className="wc-ruler-readout-v">{mb.toFixed(2)}&Prime;</span>}
        <MarkerIcon vertical />
      </div>
    </div>
  );
}

function MarkerIcon({ vertical = false }: { vertical?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden
      style={vertical ? { transform: "rotate(-90deg)" } : undefined}
    >
      <path d="M2 2h10v5l-5 5-5-5z" />
    </svg>
  );
}
