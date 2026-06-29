"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lookupDefine, lookupThesaurus } from "@/server/lookup";
import type { Definition } from "@/lib/lookup/types";
import {
  setLookupPopoverListener,
  closeLookupPopover,
  type LookupRequest,
} from "@/lib/lookup/popover-store";

// Always-mounted listener for the lookup popover store. A right-click menu item
// ("Look up" / "Find another word") calls `openLookupPopover(...)` after the
// context menu has already closed, so the popover lives here instead of inside
// the menu. Mounted once in the writing layout, like SmartTextLoader.

type DefineResult = { kind: "define"; defs: Definition[] };
type ThesaurusResult = { kind: "thesaurus"; synonyms: string[]; antonyms: string[] };
type Result = DefineResult | ThesaurusResult;

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; result: Result }
  | { phase: "error" };

const CARD_W = 288; // matches the w-72 below; used to keep the card on-screen.
const MARGIN = 8;

export function LookupPopoverHost() {
  const [req, setReq] = useState<LookupRequest | null>(null);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const cardRef = useRef<HTMLDivElement>(null);

  // Subscribe to the module store. Each new request restarts the fetch.
  useEffect(() => {
    setLookupPopoverListener((next) => setReq(next));
    return () => setLookupPopoverListener(null);
  }, []);

  // Run the lookup whenever a request opens (or its word/mode changes).
  useEffect(() => {
    if (!req) return;
    let alive = true;
    (async () => {
      setState({ phase: "loading" });
      try {
        if (req.mode === "define") {
          const defs = await lookupDefine(req.word);
          if (alive) setState({ phase: "ready", result: { kind: "define", defs } });
        } else {
          const { synonyms, antonyms } = await lookupThesaurus(req.word);
          if (alive)
            setState({
              phase: "ready",
              result: { kind: "thesaurus", synonyms, antonyms },
            });
        }
      } catch {
        if (alive) setState({ phase: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [req]);

  // Dismiss on Escape while open.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLookupPopover();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req || typeof document === "undefined") return null;

  // Anchor near the selection, clamped so the card stays inside the viewport.
  const left = Math.min(req.anchor.x, window.innerWidth - CARD_W - MARGIN);
  const top = req.anchor.y;

  const title =
    req.mode === "define" ? `Look up “${req.word}”` : `Another word for “${req.word}”`;

  function replaceWith(word: string) {
    req?.onReplace?.(word);
    closeLookupPopover();
  }

  return createPortal(
    <>
      {/* Click-away / right-click-away scrim. */}
      <div
        className="fixed inset-0 z-[2000]"
        onClick={() => closeLookupPopover()}
        onContextMenu={(e) => {
          e.preventDefault();
          closeLookupPopover();
        }}
      />
      <div
        ref={cardRef}
        role="dialog"
        className="fixed z-[2001] w-72 max-h-[60vh] overflow-y-auto rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 text-sm shadow-[var(--wc-shadow-md)]"
        style={{ left: Math.max(MARGIN, left), top }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="font-serif text-[13px] font-medium text-[var(--wc-ink)]">
            {title}
          </div>
          <button
            onClick={() => closeLookupPopover()}
            className="-mr-1 -mt-0.5 shrink-0 rounded px-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {state.phase === "loading" && (
          <div className="py-2 text-[var(--wc-faint)]">Looking up…</div>
        )}

        {state.phase === "error" && (
          <div className="py-2 text-[var(--wc-faint)]">Lookup failed. Try again.</div>
        )}

        {state.phase === "ready" && state.result.kind === "define" && (
          <DefineBody defs={state.result.defs} />
        )}

        {state.phase === "ready" && state.result.kind === "thesaurus" && (
          <ThesaurusBody
            synonyms={state.result.synonyms}
            antonyms={state.result.antonyms}
            canReplace={!!req.onReplace}
            onPick={replaceWith}
          />
        )}
      </div>
    </>,
    document.body,
  );
}

function DefineBody({ defs }: { defs: Definition[] }) {
  if (defs.length === 0) {
    return <div className="py-2 text-[var(--wc-faint)]">No definitions found.</div>;
  }
  return (
    <ol className="space-y-2">
      {defs.map((d, i) => (
        <li key={i} className="leading-snug text-[var(--wc-ink)]">
          {d.partOfSpeech && (
            <span className="mr-1.5 italic text-[var(--wc-muted)]">{d.partOfSpeech}</span>
          )}
          {d.text}
        </li>
      ))}
    </ol>
  );
}

function ThesaurusBody({
  synonyms,
  antonyms,
  canReplace,
  onPick,
}: {
  synonyms: string[];
  antonyms: string[];
  canReplace: boolean;
  onPick: (word: string) => void;
}) {
  if (synonyms.length === 0 && antonyms.length === 0) {
    return <div className="py-2 text-[var(--wc-faint)]">No synonyms found.</div>;
  }
  return (
    <div className="space-y-3">
      {synonyms.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
            Synonyms
          </div>
          <div className="flex flex-wrap gap-1.5">
            {synonyms.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                disabled={!canReplace}
                title={canReplace ? `Replace with “${s}”` : s}
                className="rounded-[var(--wc-r-sm)] border border-[var(--wc-border)] bg-[var(--wc-canvas)] px-2 py-0.5 text-[13px] text-[var(--wc-ink)] hover:border-[var(--wc-slate)] disabled:cursor-default disabled:hover:border-[var(--wc-border)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {antonyms.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
            Antonyms
          </div>
          <div className="flex flex-wrap gap-1.5">
            {antonyms.map((a) => (
              <span
                key={a}
                className="rounded-[var(--wc-r-sm)] border border-dashed border-[var(--wc-border)] px-2 py-0.5 text-[13px] text-[var(--wc-muted)]"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
