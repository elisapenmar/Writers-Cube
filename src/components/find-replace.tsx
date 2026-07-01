"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

type Match = { from: number; to: number };

function findMatches(editor: Editor, query: string, caseSensitive: boolean): Match[] {
  const out: Match[] = [];
  if (!query) return out;
  const q = caseSensitive ? query : query.toLowerCase();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = text.indexOf(q);
    while (idx !== -1) {
      out.push({ from: pos + idx, to: pos + idx + query.length });
      idx = text.indexOf(q, idx + q.length);
    }
  });
  return out;
}

/** Google-Docs-style find & replace bound to a single editor. */
export function FindReplace({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Recompute matches whenever the query (or options) change.
  useEffect(() => {
    if (editor.isDestroyed) return;
    const m = findMatches(editor, query, caseSensitive);
    // Matches derive from live editor content (not React state) and drive an
    // editor selection side-effect, so this recompute belongs in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(m);
    setCurrent(0);
    if (m[0]) selectMatch(m[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive]);

  function selectMatch(m: Match) {
    if (editor.isDestroyed) return;
    editor.commands.setTextSelection({ from: m.from, to: m.to });
    editor.commands.scrollIntoView();
  }

  function go(delta: number) {
    if (matches.length === 0) return;
    const next = (current + delta + matches.length) % matches.length;
    setCurrent(next);
    selectMatch(matches[next]);
  }

  function replaceOne() {
    if (matches.length === 0 || editor.isDestroyed) return;
    const m = matches[current];
    editor
      .chain()
      .insertContentAt({ from: m.from, to: m.to }, replaceText)
      .run();
    // Recompute after the doc changed.
    const m2 = findMatches(editor, query, caseSensitive);
    setMatches(m2);
    const next = Math.min(current, Math.max(0, m2.length - 1));
    setCurrent(next);
    if (m2[next]) selectMatch(m2[next]);
  }

  function replaceAll() {
    if (matches.length === 0 || editor.isDestroyed) return;
    const tr = editor.state.tr;
    // Replace from the end so earlier positions stay valid.
    for (let i = matches.length - 1; i >= 0; i--) {
      tr.insertText(replaceText, matches[i].from, matches[i].to);
    }
    editor.view.dispatch(tr);
    setMatches([]);
    setCurrent(0);
  }

  return (
    <div className="absolute right-4 top-3 z-30 w-[320px] rounded-lg border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] shadow-xl">
      <div className="flex items-center gap-2 p-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go(e.shiftKey ? -1 : 1);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Find in this scene…"
          className="flex-1 rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-page)] px-2 py-1 text-sm text-[var(--wc-ink)] focus:border-[var(--wc-slate)] focus:outline-none"
        />
        <span className="text-xs tabular-nums text-[var(--wc-muted)] w-14 text-right">
          {matches.length ? `${current + 1}/${matches.length}` : "0/0"}
        </span>
      </div>
      <div className="flex items-center gap-1 px-2 pb-2">
        <IconBtn title="Previous (⇧⏎)" onClick={() => go(-1)}>↑</IconBtn>
        <IconBtn title="Next (⏎)" onClick={() => go(1)}>↓</IconBtn>
        <button
          onClick={() => setCaseSensitive((c) => !c)}
          title="Match case"
          className={`rounded-md px-2 py-1 text-xs ${
            caseSensitive
              ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
              : "text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
          }`}
        >
          Aa
        </button>
        <button
          onClick={() => setShowReplace((s) => !s)}
          className="rounded-md px-2 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        >
          {showReplace ? "Hide replace" : "Replace…"}
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="ml-auto rounded-md px-2 py-1 text-sm text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
        >
          ×
        </button>
      </div>

      {showReplace && (
        <div className="flex items-center gap-2 border-t border-[var(--wc-border)] p-2">
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with…"
            className="flex-1 rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-page)] px-2 py-1 text-sm text-[var(--wc-ink)] focus:border-[var(--wc-slate)] focus:outline-none"
          />
          <button
            onClick={replaceOne}
            disabled={matches.length === 0}
            className="rounded-md border border-[var(--wc-border-strong)] px-2 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            disabled={matches.length === 0}
            className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-[var(--wc-on-accent)] disabled:opacity-40"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md px-2 py-1 text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
    >
      {children}
    </button>
  );
}
