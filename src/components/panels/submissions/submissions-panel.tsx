"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getStoryMeta,
  updateStoryMeta,
  SUBMISSION_STATUSES,
  type Submission,
  type SubmissionStatus,
  type StoryMeta,
} from "@/server/submissions";

/** Pill colors per response status. */
const STATUS_STYLE: Record<SubmissionStatus, string> = {
  Submitted: "bg-[var(--wc-canvas)] text-[var(--wc-muted)] border-[var(--wc-border-strong)]",
  Accepted: "bg-emerald-50 text-emerald-800 border-emerald-300",
  Rejected: "bg-red-50 text-red-800 border-red-300",
  Withdrawn: "bg-amber-50 text-amber-900 border-amber-300",
};

export function SubmissionsPanel() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [meta, setMeta] = useState<StoryMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [subs, m] = await Promise.all([listSubmissions(), getStoryMeta()]);
      setRows(subs);
      setMeta(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  function addSubmission() {
    startTransition(async () => {
      try {
        const created = await createSubmission();
        setRows((prev) => [...(prev ?? []), created]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  function patchRow(id: string, patch: Partial<Submission>) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeLocal(id: string) {
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
  }

  if (rows === null && !error) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading submissions…
      </div>
    );
  }

  const accepted = (rows ?? []).filter((r) => r.status === "Accepted").length;
  const live = (rows ?? []).filter((r) => r.status === "Submitted").length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <div className="text-[var(--wc-faint)]">
          {(rows?.length ?? 0)} submission{(rows?.length ?? 0) === 1 ? "" : "s"}
          {live > 0 && <span> · {live} out</span>}
          {accepted > 0 && <span> · {accepted} accepted</span>}
        </div>
        <button
          onClick={addSubmission}
          disabled={pending}
          className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {meta && <StoryMetaCard meta={meta} onSaved={setMeta} onError={setError} />}

        {(rows ?? []).length === 0 && !error ? (
          <p className="text-sm text-[var(--wc-faint)]">
            No submissions yet. Click <b>+ Add</b> to log the first market you sent this
            piece to, then track its status as replies come in.
          </p>
        ) : (
          (rows ?? []).map((r) => (
            <SubmissionRow
              key={r.id}
              submission={r}
              onPatch={(patch) => patchRow(r.id, patch)}
              onDelete={() => removeLocal(r.id)}
              onError={setError}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StoryMetaCard({
  meta,
  onSaved,
  onError,
}: {
  meta: StoryMeta;
  onSaved: (m: StoryMeta) => void;
  onError: (msg: string) => void;
}) {
  const [logline, setLogline] = useState(meta.logline);
  const [theme, setTheme] = useState(meta.theme);
  const [goal, setGoal] = useState(meta.word_goal != null ? String(meta.word_goal) : "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(patch: { logline?: string; theme?: string; word_goal?: number | null }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateStoryMeta(patch);
        onSaved({
          logline: patch.logline ?? logline,
          theme: patch.theme ?? theme,
          word_goal: patch.word_goal !== undefined ? patch.word_goal : meta.word_goal,
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      }
    }, 500);
  }

  const goalNum = goal.trim() ? Number(goal) : null;

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 space-y-2.5">
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[var(--wc-faint)] mb-0.5">
          Logline
        </label>
        <input
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          onBlur={() => {
            if (logline !== meta.logline) schedule({ logline });
          }}
          placeholder="One line: what is this story about?"
          className="w-full bg-transparent border-0 border-b border-[var(--wc-border)] outline-none font-serif text-sm text-[var(--wc-ink)] px-0 py-0.5 focus:border-[var(--wc-border-strong)]"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[var(--wc-faint)] mb-0.5">
          Theme
        </label>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onBlur={() => {
            if (theme !== meta.theme) schedule({ theme });
          }}
          placeholder="The idea underneath it all"
          className="w-full bg-transparent border-0 border-b border-[var(--wc-border)] outline-none font-serif text-sm text-[var(--wc-ink)] px-0 py-0.5 focus:border-[var(--wc-border-strong)]"
        />
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <label className="text-[10px] uppercase tracking-wide text-[var(--wc-faint)]">
          Word target
        </label>
        <input
          type="number"
          min={0}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => {
            if ((goalNum ?? null) !== meta.word_goal) schedule({ word_goal: goalNum });
          }}
          placeholder="e.g. 5000"
          className="w-28 bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1 text-sm text-[var(--wc-ink)] outline-none focus:border-[var(--wc-border-strong)]"
        />
        <span className="text-xs text-[var(--wc-faint)]">words</span>
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  onPatch,
  onDelete,
  onError,
}: {
  submission: Submission;
  onPatch: (patch: Partial<Submission>) => void;
  onDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [market, setMarket] = useState(submission.market);
  const [notes, setNotes] = useState(submission.notes);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMarket(submission.market);
    setNotes(submission.notes);
  }, [submission.id, submission.market, submission.notes]);

  function schedule(patch: Partial<Submission>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateSubmission(submission.id, {
          market: patch.market,
          status: patch.status,
          sent_at: patch.sent_at,
          response_at: patch.response_at,
          notes: patch.notes,
        });
        onPatch(patch);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  // Status changes save immediately (no debounce on a discrete choice).
  async function setStatus(status: SubmissionStatus) {
    setSaving(true);
    try {
      const patch: Partial<Submission> = { status };
      // First reply (response) gets today's date if none recorded yet.
      if (status !== "Submitted" && !submission.response_at) {
        patch.response_at = new Date().toISOString().slice(0, 10);
      }
      await updateSubmission(submission.id, patch);
      onPatch(patch);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the submission to "${submission.market}"?`)) return;
    try {
      await deleteSubmission(submission.id);
      onDelete();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 w-4 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          title={expanded ? "Collapse" : "Expand details"}
          aria-label="Toggle submission details"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <input
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          onBlur={() => {
            if (market !== submission.market) schedule({ market });
          }}
          placeholder="Market or magazine"
          className="flex-1 bg-transparent border-0 outline-none font-serif text-base text-[var(--wc-ink)] px-0"
        />
        <select
          value={submission.status}
          onChange={(e) => setStatus(e.target.value as SubmissionStatus)}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] outline-none cursor-pointer ${STATUS_STYLE[submission.status]}`}
          title="Response status"
        >
          {SUBMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={handleDelete}
          className="text-xs text-[var(--wc-faint)] hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>

      {!expanded ? (
        <div
          onClick={() => setExpanded(true)}
          className="mt-1 cursor-pointer text-xs text-[var(--wc-faint)] hover:bg-[var(--wc-canvas)] rounded px-1 -mx-1"
        >
          {submission.sent_at ? `Sent ${submission.sent_at}` : "No send date"}
          {submission.response_at && <span> · replied {submission.response_at}</span>}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[var(--wc-faint)]">
              Sent
              <input
                type="date"
                value={submission.sent_at ?? ""}
                onChange={(e) => schedule({ sent_at: e.target.value || null })}
                className="bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-1.5 py-0.5 text-xs text-[var(--wc-ink)] outline-none focus:border-[var(--wc-border-strong)]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--wc-faint)]">
              Reply
              <input
                type="date"
                value={submission.response_at ?? ""}
                onChange={(e) => schedule({ response_at: e.target.value || null })}
                className="bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-1.5 py-0.5 text-xs text-[var(--wc-ink)] outline-none focus:border-[var(--wc-border-strong)]"
              />
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== submission.notes) schedule({ notes });
            }}
            rows={2}
            placeholder="Notes: response time, personal feedback, tier, reprint rights…"
            className="w-full bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1.5 text-sm font-serif leading-relaxed outline-none focus:border-[var(--wc-border-strong)]"
          />
        </div>
      )}

      {saving && <div className="text-[10px] text-[var(--wc-faint)] mt-1">Saving…</div>}
    </div>
  );
}
