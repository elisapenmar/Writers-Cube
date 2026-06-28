"use client";

import { useState } from "react";
import {
  setFeedbackStatus,
  type FeedbackEntry,
  type FeedbackStatus,
} from "@/server/feedback";

const CATEGORY_META: Record<FeedbackEntry["category"], { label: string; emoji: string }> = {
  praise: { label: "Praise", emoji: "💛" },
  issue: { label: "Issue", emoji: "🐛" },
  suggestion: { label: "Suggestion", emoji: "💡" },
};
const FACE = ["", "😞", "🙁", "😐", "🙂", "😄"];
const STATUSES: FeedbackStatus[] = ["new", "triaged", "resolved"];

export function FeedbackAdminList({ initial }: { initial: FeedbackEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [filter, setFilter] = useState<"all" | FeedbackEntry["category"]>("all");

  async function changeStatus(id: string, status: FeedbackStatus) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    try {
      await setFeedbackStatus(id, status);
    } catch {
      /* optimistic; a refresh will reconcile */
    }
  }

  const visible = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  if (entries.length === 0) {
    return (
      <p className="rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-8 text-center text-sm text-[var(--wc-faint)]">
        No feedback yet.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(["all", "praise", "issue", "suggestion"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f
                ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
                : "border border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:text-[var(--wc-ink)]"
            }`}
          >
            {f === "all" ? "All" : CATEGORY_META[f].label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((e) => {
          const cat = CATEGORY_META[e.category];
          return (
            <li
              key={e.id}
              className="rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4"
              data-status={e.status}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[var(--wc-faint)]">
                    <span className="rounded-full bg-[var(--wc-canvas)] px-2 py-0.5">
                      {cat.emoji} {cat.label}
                    </span>
                    {e.rating != null && <span className="text-base" title={`Rating ${e.rating}/5`}>{FACE[e.rating]}</span>}
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  {e.title && (
                    <h3 className="mt-1 font-serif text-base text-[var(--wc-ink)]">{e.title}</h3>
                  )}
                </div>
                <select
                  value={e.status}
                  onChange={(ev) => changeStatus(e.id, ev.target.value as FeedbackStatus)}
                  className="shrink-0 rounded border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-1.5 py-1 text-xs text-[var(--wc-ink)]"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {e.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--wc-muted)]">{e.body}</p>
              )}

              {e.screenshot_url && (
                <a href={e.screenshot_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={e.screenshot_url}
                    alt="Attached screenshot"
                    className="mt-2 max-h-48 rounded border border-[var(--wc-border)]"
                  />
                </a>
              )}

              <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--wc-faint)]">
                {e.email && <span>{e.email}</span>}
                {e.page_url && <span>on {e.page_url}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
