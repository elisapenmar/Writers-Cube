"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listSources,
  addSource,
  updateSource,
  deleteSource,
  gatherSources,
  type Source,
  type SourceInput,
  type SourceSuggestion,
} from "@/server/research";

const KINDS = ["website", "article", "book", "journal", "news", "report", "other"];

/**
 * Research / source manager for the essay form. Two tabs feed off the same saved
 * source list: Sources (manual add + AI gather) and Works Cited (formatted
 * bibliography). Both mount this component; `view` decides which face shows.
 */
export function ResearchPanel({ view }: { view: "sources" | "cited" }) {
  const [rows, setRows] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setRows(await listSources());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sources");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  if (rows === null && !error) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading sources…
      </div>
    );
  }

  if (view === "cited") {
    return <WorksCitedView rows={rows ?? []} error={error} onDismissError={() => setError(null)} />;
  }

  return (
    <SourcesView
      rows={rows ?? []}
      error={error}
      setError={setError}
      onChanged={reload}
      setRows={setRows}
    />
  );
}

function SourcesView({
  rows,
  error,
  setError,
  onChanged,
  setRows,
}: {
  rows: Source[];
  error: string | null;
  setError: (s: string | null) => void;
  onChanged: () => Promise<void>;
  setRows: React.Dispatch<React.SetStateAction<Source[] | null>>;
}) {
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<SourceSuggestion[] | null>(null);
  const [gathering, startGather] = useTransition();
  const [searched, setSearched] = useState(true);

  function runGather() {
    setError(null);
    startGather(async () => {
      try {
        const res = await gatherSources();
        setSuggestions(res.suggestions);
        setSearched(res.searched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Source search failed");
      }
    });
  }

  async function acceptSuggestion(s: SourceSuggestion) {
    try {
      const created = await addSource({
        url: s.url,
        title: s.title,
        author: s.author,
        publication: s.publication,
        published_date: s.published_date,
        note: s.reason,
        kind: s.kind,
      });
      setRows((prev) => [created, ...(prev ?? [])]);
      setSuggestions((prev) => (prev ?? []).filter((x) => x.url !== s.url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save source");
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <div className="text-[var(--wc-faint)]">
          {rows.length} source{rows.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={runGather}
            disabled={gathering}
            className="rounded-md border border-[var(--wc-border-strong)] px-2 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
            title="Have the AI search the web for sources on your topic"
          >
            {gathering ? "Searching…" : "🔎 Find sources"}
          </button>
          <button
            onClick={() => setAdding((a) => !a)}
            className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)]"
          >
            {adding ? "Close" : "+ Add"}
          </button>
        </div>
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

        {adding && (
          <AddSourceForm
            onCancel={() => setAdding(false)}
            onSaved={async () => {
              setAdding(false);
              await onChanged();
            }}
            onError={setError}
          />
        )}

        {suggestions && (
          <SuggestionList
            suggestions={suggestions}
            searched={searched}
            onAccept={acceptSuggestion}
            onClose={() => setSuggestions(null)}
          />
        )}

        {rows.length === 0 && !adding ? (
          <p className="text-sm text-[var(--wc-faint)]">
            No sources yet. Add one by hand, or use Find sources to search the web for material on
            your topic. Everything you save here flows into the Works Cited tab.
          </p>
        ) : (
          rows.map((r) => (
            <SourceCard
              key={r.id}
              row={r}
              onPatch={(patch) =>
                setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, ...patch } : x)))
              }
              onRemoved={() => setRows((prev) => (prev ?? []).filter((x) => x.id !== r.id))}
              onError={setError}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SuggestionList({
  suggestions,
  searched,
  onAccept,
  onClose,
}: {
  suggestions: SourceSuggestion[];
  searched: boolean;
  onAccept: (s: SourceSuggestion) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-canvas)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm text-[var(--wc-ink)]">Suggested sources</h3>
        <button
          onClick={onClose}
          className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] text-xs"
        >
          Dismiss
        </button>
      </div>
      <p className="text-[11px] text-[var(--wc-faint)] leading-snug">
        {searched
          ? "These came from a live web search. Open each link to confirm it says what you need before accepting."
          : "Web search was unavailable, so these are unverified suggestions. Open each link to confirm it is real and relevant before accepting."}
      </p>
      {suggestions.map((s, i) => (
        <div
          key={`${s.url}-${i}`}
          className="rounded border border-[var(--wc-border)] bg-[var(--wc-surface)] p-2.5 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--wc-ink)] truncate">
                {s.title || s.publication || s.url}
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--wc-slate)] underline break-all"
              >
                {s.url}
              </a>
              {s.reason && (
                <p className="mt-1 text-[var(--wc-muted)] leading-snug">{s.reason}</p>
              )}
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                s.verified
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900"
              }`}
              title={
                s.verified
                  ? "URL returned by a live web search"
                  : "Unverified: open and check the link before accepting"
              }
            >
              {s.verified ? "from search" : "verify"}
            </span>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => onAccept(s)}
              className="rounded-md bg-[var(--wc-slate)] px-2 py-0.5 text-[11px] text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)]"
            >
              Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const BLANK: Required<SourceInput> = {
  url: "",
  title: "",
  author: "",
  publication: "",
  published_date: "",
  quote: "",
  note: "",
  kind: "website",
};

function AddSourceForm({
  onCancel,
  onSaved,
  onError,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Required<SourceInput>>({ ...BLANK });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SourceInput>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!draft.title.trim() && !draft.url.trim()) {
      onError("Give the source at least a title or a URL.");
      return;
    }
    setSaving(true);
    try {
      await addSource(draft);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save source");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded px-2 py-1 text-sm outline-none focus:border-[var(--wc-border-strong)]";

  return (
    <div className="rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-canvas)] p-3 space-y-2">
      <input
        className={field}
        placeholder="Title"
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
      />
      <input
        className={field}
        placeholder="URL"
        value={draft.url}
        onChange={(e) => set("url", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={field}
          placeholder="Author (Last, First)"
          value={draft.author}
          onChange={(e) => set("author", e.target.value)}
        />
        <input
          className={field}
          placeholder="Publication / site"
          value={draft.publication}
          onChange={(e) => set("publication", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={field}
          placeholder="Date (e.g. 2024-05-01)"
          value={draft.published_date}
          onChange={(e) => set("published_date", e.target.value)}
        />
        <select
          className={field}
          value={draft.kind}
          onChange={(e) => set("kind", e.target.value)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={field}
        rows={2}
        placeholder="Quote (a passage you may cite)"
        value={draft.quote}
        onChange={(e) => set("quote", e.target.value)}
      />
      <textarea
        className={field}
        rows={2}
        placeholder="Note (why this matters)"
        value={draft.note}
        onChange={(e) => set("note", e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-[var(--wc-border-strong)] px-2.5 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-surface)]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[var(--wc-slate)] px-2.5 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save source"}
        </button>
      </div>
    </div>
  );
}

function SourceCard({
  row,
  onPatch,
  onRemoved,
  onError,
}: {
  row: Source;
  onPatch: (patch: Partial<Source>) => void;
  onRemoved: () => void;
  onError: (s: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState({
    title: row.title,
    url: row.url,
    author: row.author,
    publication: row.publication,
    published_date: row.published_date,
    quote: row.quote,
    note: row.note,
    kind: row.kind,
  });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft({
      title: row.title,
      url: row.url,
      author: row.author,
      publication: row.publication,
      published_date: row.published_date,
      quote: row.quote,
      note: row.note,
      kind: row.kind,
    });
  }, [row.id, row.title, row.url, row.author, row.publication, row.published_date, row.quote, row.note, row.kind]);

  function schedule(patch: SourceInput) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateSource(row.id, patch);
        onPatch(patch as Partial<Source>);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  function edit<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    schedule({ [key]: value } as SourceInput);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${row.title || row.url || "this source"}"?`)) return;
    try {
      await deleteSource(row.id);
      onRemoved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const field =
    "w-full bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1 text-sm outline-none focus:border-[var(--wc-border-strong)]";

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 w-4 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          title={expanded ? "Collapse" : "Expand details"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-base text-[var(--wc-ink)] truncate">
            {draft.title || draft.publication || draft.url || "Untitled source"}
          </div>
          {draft.url && (
            <a
              href={draft.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--wc-slate)] underline break-all"
            >
              {draft.url}
            </a>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-[var(--wc-faint)]">{draft.kind}</span>
        <button
          onClick={handleDelete}
          className="text-xs text-[var(--wc-faint)] hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <input className={field} placeholder="Title" value={draft.title} onChange={(e) => edit("title", e.target.value)} />
          <input className={field} placeholder="URL" value={draft.url} onChange={(e) => edit("url", e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Author (Last, First)" value={draft.author} onChange={(e) => edit("author", e.target.value)} />
            <input className={field} placeholder="Publication / site" value={draft.publication} onChange={(e) => edit("publication", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Date" value={draft.published_date} onChange={(e) => edit("published_date", e.target.value)} />
            <select className={field} value={draft.kind} onChange={(e) => edit("kind", e.target.value)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <textarea className={field} rows={2} placeholder="Quote" value={draft.quote} onChange={(e) => edit("quote", e.target.value)} />
          <textarea className={field} rows={2} placeholder="Note" value={draft.note} onChange={(e) => edit("note", e.target.value)} />
          {saving && <div className="text-[10px] text-[var(--wc-faint)]">Saving…</div>}
        </div>
      )}
    </div>
  );
}

// --- Works Cited -----------------------------------------------------------

type Style = "mla" | "apa" | "chicago";
const STYLE_LABEL: Record<Style, string> = { mla: "MLA", apa: "APA", chicago: "Chicago" };

function WorksCitedView({
  rows,
  error,
  onDismissError,
}: {
  rows: Source[];
  error: string | null;
  onDismissError: () => void;
}) {
  const [style, setStyle] = useState<Style>("mla");
  const [copied, setCopied] = useState(false);

  const entries = [...rows]
    .map((r) => formatCitation(r, style))
    .filter((e) => e.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
  const text = entries.join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  function download() {
    const blob = new Blob([`Works Cited (${STYLE_LABEL[style]})\n\n${text}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `works-cited-${style}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs gap-2">
        <div className="flex">
          {(Object.keys(STYLE_LABEL) as Style[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`py-1 px-2 text-xs border ${i === 0 ? "rounded-l-md" : "-ml-px"} ${
                i === 2 ? "rounded-r-md" : ""
              } ${
                style === s
                  ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)] border-[var(--wc-slate)]"
                  : "bg-[var(--wc-surface)] border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
              }`}
            >
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copy}
            disabled={entries.length === 0}
            className="rounded-md border border-[var(--wc-border-strong)] px-2 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            disabled={entries.length === 0}
            className="rounded-md border border-[var(--wc-border-strong)] px-2 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          >
            Download
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
            {error}
            <button onClick={onDismissError} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--wc-faint)]">
            No sources to cite yet. Add sources in the Sources tab and they appear here as a
            formatted bibliography.
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((e, i) => (
              <li
                key={i}
                className="text-sm font-serif leading-relaxed text-[var(--wc-ink)] pl-6 -indent-6"
              >
                {e}
              </li>
            ))}
          </ol>
        )}
        {entries.length > 0 && (
          <p className="text-[11px] text-[var(--wc-faint)] leading-snug pt-2 border-t border-[var(--wc-border)]">
            Auto-formatted as a starting point. Check each entry against your style guide, machine
            citations are not perfect.
          </p>
        )}
      </div>
    </div>
  );
}

/** Pull a 4-digit year out of whatever the writer typed in the date field. */
function yearOf(date: string): string {
  const m = date.match(/\d{4}/);
  return m ? m[0] : "";
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Build one bibliography entry. Plain-text (no italics), which keeps copy/paste
 * and download clean; the writer applies italics in their word processor. Empty
 * fields are skipped so partial sources still produce something usable.
 */
function formatCitation(s: Source, style: Style): string {
  const author = s.author.trim();
  const title = s.title.trim();
  const publication = s.publication.trim();
  const date = s.published_date.trim();
  const url = s.url.trim();
  const year = yearOf(date);

  const parts: string[] = [];

  if (style === "apa") {
    // Author, A. (Year). Title. Publication. URL
    if (author) parts.push(ensurePeriod(author));
    parts.push(`(${year || "n.d."}).`);
    if (title) parts.push(ensurePeriod(title));
    if (publication) parts.push(ensurePeriod(publication));
    if (url) parts.push(url);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  if (style === "chicago") {
    // Author. "Title." Publication. Date. URL.
    if (author) parts.push(ensurePeriod(author));
    if (title) parts.push(`"${ensurePeriod(title)}"`);
    if (publication) parts.push(ensurePeriod(publication));
    if (date) parts.push(ensurePeriod(date));
    if (url) parts.push(ensurePeriod(url));
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  // MLA: Author. "Title." Publication, Date, URL.
  if (author) parts.push(ensurePeriod(flipNameLast(author)));
  if (title) parts.push(`"${ensurePeriod(title)}"`);
  const tail: string[] = [];
  if (publication) tail.push(publication);
  if (date) tail.push(date);
  if (url) tail.push(url);
  if (tail.length) parts.push(ensurePeriod(tail.join(", ")));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** MLA keeps the first author "Last, First"; normalize stray "First Last". */
function flipNameLast(author: string): string {
  if (author.includes(",")) return author.trim();
  const parts = author.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts.pop() as string;
    return `${last}, ${parts.join(" ")}`;
  }
  return author.trim();
}
