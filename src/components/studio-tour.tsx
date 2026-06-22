"use client";

import { useCallback, useEffect, useState } from "react";

const SEEN_KEY = "wc_studio_tour_v1";

type Stop = { sel: string; title: string; body: string };

const STOPS: Stop[] = [
  {
    sel: '[data-tour="view-toggle"]',
    title: "Two ways to write",
    body: "Switch between editing one scene at a time and reading your whole manuscript as a continuous scroll.",
  },
  {
    sel: '[data-tour="brainstorm"]',
    title: "Brainstorm",
    body: "Talk through ideas with an AI thought-partner, then turn the conversation into notes or a map.",
  },
  {
    sel: '[data-tour="bible"]',
    title: "Story Bible",
    body: "Characters, an outline, a thought map, and a timeline — build them by hand or generate from your draft.",
  },
  {
    sel: '[data-tour="organize"]',
    title: "Organize",
    body: "A home for working notes and a freeform canvas of references and clippings.",
  },
  {
    sel: '[data-tour="prompts"]',
    title: "Prompts",
    body: "Stuck? Roll a writing prompt — grounded in your own story whenever you want it.",
  },
  {
    sel: '[data-tour="publish"]',
    title: "Publish",
    body: "Format and export your book to EPUB, a print-ready PDF, or Word when you're ready.",
  },
];

export function StudioTour() {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(() => {
    setI(0);
    setActive(true);
  }, []);

  // Auto-start once for a new writer; allow manual replay via event.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    const t = seen ? undefined : setTimeout(start, 700);
    const onStart = () => start();
    window.addEventListener("wc:start-tour", onStart);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("wc:start-tour", onStart);
    };
  }, [start]);

  function finish() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
    setRect(null);
    setI(0);
  }

  // Find the next existing target and measure it.
  useEffect(() => {
    if (!active) return;
    let idx = i;
    while (idx < STOPS.length && !document.querySelector(STOPS[idx].sel)) idx++;
    if (idx >= STOPS.length) {
      finish();
      return;
    }
    if (idx !== i) {
      setI(idx);
      return;
    }
    const el = document.querySelector(STOPS[idx].sel) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      setRect(el.getBoundingClientRect());
    }
  }, [active, i]);

  useEffect(() => {
    if (!active) return;
    const remeasure = () => {
      const el = document.querySelector(STOPS[i].sel) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [active, i]);

  if (!active || !rect) return null;

  const stop = STOPS[i];
  const pad = 6;
  const tipW = 300;
  // Place the tooltip to the right of the (left-side) nav target.
  const tipX = Math.min(rect.right + 16, window.innerWidth - tipW - 16);
  const tipY = Math.min(Math.max(rect.top - 4, 16), window.innerHeight - 200);

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Spotlight: dim everything except the target via a giant box-shadow. */}
      <div
        style={{
          position: "fixed",
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 12,
          boxShadow: "0 0 0 9999px rgba(20,18,24,0.55)",
          outline: "2px solid var(--wc-slate)",
          pointerEvents: "none",
        }}
      />
      <div
        className="fixed rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 shadow-[var(--wc-shadow-md)]"
        style={{ left: tipX, top: tipY, width: tipW }}
      >
        <div className="text-[11px] uppercase tracking-widest text-[var(--wc-slate)]">
          {i + 1} of {STOPS.length}
        </div>
        <div className="mt-1 font-serif text-lg text-[var(--wc-ink)]">{stop.title}</div>
        <p className="mt-1 text-sm text-[var(--wc-muted)] leading-relaxed">{stop.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI((s) => s - 1)}
                className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (i >= STOPS.length - 1 ? finish() : setI((s) => s + 1))}
              className="rounded-[var(--wc-r-md)] px-4 py-1.5 text-sm text-[var(--wc-on-accent)]"
              style={{ background: "var(--wc-slate)" }}
            >
              {i >= STOPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
