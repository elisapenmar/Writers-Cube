"use client";

import { useState, useTransition } from "react";
import { setProjectWordGoal } from "@/server/projects";

/** Word-count goal meter for a project card: set a target, see progress. */
export function ProjectGoal({
  projectId,
  wordCount,
  initialGoal,
}: {
  projectId: string;
  wordCount: number;
  initialGoal: number | null;
}) {
  const [goal, setGoal] = useState<number | null>(initialGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialGoal ? String(initialGoal) : "");
  const [, start] = useTransition();

  function save(next: number | null) {
    setGoal(next);
    setEditing(false);
    start(async () => {
      try {
        await setProjectWordGoal(projectId, next);
      } catch {
        /* leave optimistic value; a reload will resync */
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(draft ? Number(draft) : null);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Target words"
          className="w-28 rounded border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-0.5 text-xs"
        />
        <button
          type="button"
          onClick={() => save(draft ? Number(draft) : null)}
          className="text-xs text-[var(--wc-slate)] hover:underline"
        >
          Set
        </button>
        {goal != null && (
          <button
            type="button"
            onClick={() => save(null)}
            className="text-[10px] text-[var(--wc-faint)] hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  if (goal == null) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="mt-2 text-[11px] text-[var(--wc-faint)] hover:text-[var(--wc-slate)] hover:underline"
      >
        🎯 Set a word goal
      </button>
    );
  }

  const pct = Math.min(100, Math.round((wordCount / goal) * 100));
  const remaining = Math.max(0, goal - wordCount);
  const done = wordCount >= goal;

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(goal));
        setEditing(true);
      }}
      className="mt-2 block w-full text-left"
      title="Edit word goal"
    >
      <div className="flex items-center justify-between text-[11px] text-[var(--wc-faint)] mb-0.5">
        <span>
          🎯 {wordCount.toLocaleString()} / {goal.toLocaleString()}
        </span>
        <span>{done ? "Goal met ✓" : `${pct}% · ${remaining.toLocaleString()} to go`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--wc-paper)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--wc-slate)" }}
        />
      </div>
    </button>
  );
}
