"use client";

import { useCallback, useEffect, useState } from "react";

const SEEN_KEY = "wc_dashboard_tour_v1";

type Stop = { sel: string; title: string; body: string };

// Spotlight stops across the dashboard. Missing targets are skipped, so empty
// sections (e.g. no inspirations yet) don't break the flow.
const STOPS: Stop[] = [
  {
    sel: '[data-tour="dash-hero"]',
    title: "Welcome to Writer's Cube",
    body: "This is your desk. From here you start projects, capture sparks, and warm up before you write. Here's the quick lay of the land.",
  },
  {
    sel: '[data-tour="dash-prompt"]',
    title: "Beat the blank page",
    body: "Roll a writing prompt to warm up. You can keep it freeform or ground it in one of your own stories.",
  },
  {
    sel: '[data-tour="dash-projects"]',
    title: "Your projects",
    body: "Start a new novel, short story, poem, or essay — or import a manuscript you've already begun. Open one to write.",
  },
  {
    sel: '[data-tour="dash-kernels"]',
    title: "Story kernels",
    body: "A spot to park half-formed ideas — a what-if, an image, a first line — before they slip away.",
  },
  {
    sel: '[data-tour="dash-inspirations"]',
    title: "Inspirations",
    body: "Capture passages from what you read. Later, prompts can draw on them to spark your own writing.",
  },
  {
    sel: '[data-tour="dash-practice"]',
    title: "Practice library",
    body: "Standalone warm-ups you write from Writer's Cube land here, so you can revisit them anytime.",
  },
  {
    sel: '[data-tour="dash-account"]',
    title: "Make it yours",
    body: "Open this menu to change the look — five color styles and the cube background — or to sign out. That's the tour. Happy writing!",
  },
];

const TIP_W = 320;
const TIP_H = 190; // estimate for placement
const GAP = 14;

export function DashboardTour({ autoStart = false }: { autoStart?: boolean }) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(() => {
    setI(0);
    setActive(true);
  }, []);

  // Auto-start once for a first-time writer; always replayable via the event.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    const t = autoStart && !seen ? setTimeout(start, 800) : undefined;
    const onStart = () => start();
    window.addEventListener("wc:start-dashboard-tour", onStart);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("wc:start-dashboard-tour", onStart);
    };
  }, [autoStart, start]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
    setRect(null);
    setI(0);
  }, []);

  // Find the next existing target, scroll it into view, and measure it.
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
      el.scrollIntoView({ block: "center" });
      setRect(el.getBoundingClientRect());
    }
  }, [active, i, finish]);

  // Keep the spotlight glued to the target while scrolling / resizing.
  useEffect(() => {
    if (!active) return;
    const remeasure = () => {
      const el = document.querySelector(STOPS[i].sel) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [active, i]);

  if (!active || !rect) return null;

  const stop = STOPS[i];
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer below the target; flip above if it won't fit; else pin near the top.
  let top: number;
  if (rect.bottom + GAP + TIP_H <= vh) top = rect.bottom + GAP;
  else if (rect.top - GAP - TIP_H >= 0) top = rect.top - GAP - TIP_H;
  else top = Math.max(16, Math.min(vh - TIP_H - 16, rect.top));
  const left = Math.max(16, Math.min(vw - TIP_W - 16, rect.left));

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
          borderRadius: 14,
          boxShadow: "0 0 0 9999px rgba(20,18,24,0.55)",
          outline: "2px solid var(--wc-slate)",
          pointerEvents: "none",
          transition: "all 160ms ease",
        }}
      />
      <div
        className="fixed rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 shadow-[var(--wc-shadow-md)]"
        style={{ left, top, width: TIP_W }}
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
