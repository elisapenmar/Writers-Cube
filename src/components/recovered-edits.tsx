"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listRecoveredEdits,
  dismissRecoveredEdit,
  dismissAllRecoveredEdits,
  type RecoveredEdit,
} from "@/server/conflicts";

/** Extract readable plain text from Tiptap JSON (or a plain string) for preview. */
function toPlainText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[]; role?: string };
    if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
    if (typeof node.role === "string" && typeof node.text === "string") {
      parts.push(`${node.role}: ${node.text}`);
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  if (Array.isArray(value)) value.forEach(walk);
  else walk(value);
  return parts.join(" ").trim();
}

function label(entityType: string): string {
  switch (entityType) {
    case "scene":
      return "Scene";
    case "loose_scene":
      return "Note";
    case "brainstorm":
      return "Brainstorm";
    case "outline":
      return "Outline";
    case "character":
      return "Character";
    case "exercise":
      return "Exercise";
    default:
      return entityType;
  }
}

/**
 * Read-only surface for preserved "loser" edits from same-field collisions
 * (see content_conflicts / compare-and-swap). Touches no live content — it only
 * lets the writer read, copy back, and dismiss recovered text.
 */
export function RecoveredEdits() {
  const [edits, setEdits] = useState<RecoveredEdit[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    listRecoveredEdits()
      .then(setEdits)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function dismiss(id: string) {
    setEdits((prev) => prev.filter((e) => e.id !== id));
    await dismissRecoveredEdit(id).catch(() => {});
  }

  async function dismissAll() {
    setEdits([]);
    setOpen(false);
    await dismissAllRecoveredEdits().catch(() => {});
  }

  if (edits.length === 0) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg ring-1 ring-amber-300 hover:bg-amber-200"
        >
          ⚠ {edits.length} recovered edit{edits.length === 1 ? "" : "s"} — click to review
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--wc-surface,white)] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recovered edits</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-[var(--wc-faint,#888)] hover:underline"
              >
                Close
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--wc-faint,#666)]">
              These edits were preserved when two changes to the same text arrived
              at once. Nothing was lost. Copy anything you want to keep back into
              place, then dismiss it.
            </p>
            <ul className="space-y-3">
              {edits.map((e) => {
                const text = toPlainText(e.value);
                return (
                  <li key={e.id} className="rounded border border-[var(--wc-line,#e5e5e5)] p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--wc-faint,#888)]">
                      <span>
                        {label(e.entity_type)} · {e.word_count} word
                        {e.word_count === 1 ? "" : "s"} ·{" "}
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm">
                      {text || "(no preview)"}
                    </p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <button
                        onClick={() => navigator.clipboard?.writeText(text)}
                        className="text-[var(--wc-accent,#2563eb)] hover:underline"
                      >
                        Copy text
                      </button>
                      <button
                        onClick={() => dismiss(e.id)}
                        className="text-[var(--wc-faint,#888)] hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 text-right">
              <button
                onClick={dismissAll}
                className="text-sm text-[var(--wc-faint,#888)] hover:underline"
              >
                Dismiss all
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
