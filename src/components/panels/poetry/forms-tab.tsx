"use client";

import { useState } from "react";
import { POETIC_FORMS, type PoeticForm, type LineConstraint } from "@/lib/poetic-forms";
import { insertVerseScaffold, useActiveEditor } from "@/store/active-editor-store";

export function FormsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const hasEditor = useActiveEditor((s) => s.editor !== null);

  function insert(form: PoeticForm) {
    const ok = insertVerseScaffold(form.buildScaffold());
    setNote(
      ok
        ? `Inserted a ${form.name} scaffold into your poem.`
        : "Open a poem first, then insert a scaffold.",
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {note && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          {note}
        </div>
      )}
      <p className="mb-3 px-1 text-xs text-[var(--wc-faint)]">
        Classic forms with their rhyme scheme and line shape. Insert a blank
        scaffold to write straight into the pattern.
      </p>
      <ul className="space-y-2">
        {POETIC_FORMS.map((form) => {
          const open = expanded === form.id;
          return (
            <li
              key={form.id}
              className="rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)]"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : form.id)}
                className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left"
              >
                <span>
                  <span className="block font-serif text-sm text-[var(--wc-ink)]">
                    {form.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--wc-muted)]">
                    {form.lineCount} lines · {form.rhymeScheme}
                  </span>
                </span>
                <span className="mt-1 text-[10px] text-[var(--wc-faint)]">
                  {open ? "▴" : "▾"}
                </span>
              </button>

              {open && (
                <div className="border-t border-[var(--wc-border)] px-3 py-2.5 text-xs">
                  <p className="mb-2 leading-snug text-[var(--wc-ink)]">
                    {form.description}
                  </p>
                  {form.lineConstraints.length > 0 && (
                    <ul className="mb-2.5 space-y-1">
                      {form.lineConstraints.map((c, i) => (
                        <li key={i} className="text-[var(--wc-muted)]">
                          <span className="text-[var(--wc-faint)]">{constraintLabel(c)}: </span>
                          {constraintDetail(c)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => insert(form)}
                    disabled={!hasEditor}
                    className="rounded-md bg-[var(--wc-slate)] px-3 py-1.5 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
                    title={
                      hasEditor
                        ? "Drop a blank scaffold of this form into the open poem"
                        : "Open a poem to insert a scaffold"
                    }
                  >
                    Insert scaffold
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function constraintLabel(c: LineConstraint): string {
  if (c.lines.length === 1) return `Line ${c.lines[0]}`;
  // Contiguous range gets a tidy "Lines a-b"; otherwise list them.
  const sorted = [...c.lines].sort((a, b) => a - b);
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (contiguous) return `Lines ${sorted[0]}-${sorted[sorted.length - 1]}`;
  return `Lines ${sorted.join(", ")}`;
}

function constraintDetail(c: LineConstraint): string {
  const parts: string[] = [];
  if (typeof c.syllables === "number") parts.push(`${c.syllables} syllables`);
  if (c.note) parts.push(c.note);
  return parts.join(". ") || "Open form.";
}
