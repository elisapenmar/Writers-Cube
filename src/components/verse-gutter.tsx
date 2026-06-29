"use client";

// Per-line syllable gutter for verse mode. Reads the live text of each visual
// line in the editor and counts syllables client-side with the browser-safe
// `syllable` package (no server round-trip per keystroke). Positions each count
// next to its line by measuring the rendered DOM, so it stays aligned as the
// poem grows.
//
// A "line" here is one run of text between hard breaks (Enter or Shift+Enter)
// inside the editor, matching how a poet reads the verse.

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { syllable } from "syllable";

type GutterLine = { top: number; count: number };

export function VerseGutter({ editor }: { editor: Editor }) {
  const [lines, setLines] = useState<GutterLine[]>([]);

  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    const container = dom.parentElement;
    if (!container) return;

    function measure() {
      const containerTop = (container as HTMLElement).getBoundingClientRect().top;
      const next: GutterLine[] = [];
      // Each block (paragraph = stanza) holds text split by <br> hard breaks.
      // We walk the block's child nodes, grouping text between breaks into lines
      // and using a Range to find each line's vertical position.
      dom.querySelectorAll<HTMLElement>("p, h1, h2, h3, blockquote").forEach((block) => {
        collectLines(block).forEach(({ text, top }) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          next.push({ top: top - containerTop, count: syllable(trimmed) });
        });
      });
      setLines(next);
    }

    measure();
    // Re-measure on edits and on layout changes (zoom, width, fonts loading).
    const onUpdate = () => measure();
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    const ro = new ResizeObserver(() => measure());
    ro.observe(dom);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
      ro.disconnect();
    };
  }, [editor]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 w-10 select-none text-right"
    >
      {lines.map((l, i) => (
        <span
          key={i}
          className="absolute right-1 text-[11px] tabular-nums text-[var(--wc-faint)]"
          style={{ top: l.top }}
        >
          {l.count}
        </span>
      ))}
    </div>
  );
}

/** Split a block element into visual lines at its <br> hard breaks, returning
 *  each line's text and its top offset (viewport coords). */
function collectLines(block: HTMLElement): { text: string; top: number }[] {
  const out: { text: string; top: number }[] = [];
  let buffer: Node[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      // An empty line (e.g. block with only a <br>) still has a position.
      out.push({ text: "", top: block.getBoundingClientRect().top });
      return;
    }
    const range = document.createRange();
    range.setStartBefore(buffer[0]);
    range.setEndAfter(buffer[buffer.length - 1]);
    const rect = range.getBoundingClientRect();
    const text = buffer.map((n) => n.textContent ?? "").join("");
    out.push({ text, top: rect.top });
    range.detach();
    buffer = [];
  };

  block.childNodes.forEach((node) => {
    if (node.nodeName === "BR") {
      flush();
    } else {
      buffer.push(node);
    }
  });
  flush();
  return out;
}
