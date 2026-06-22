"use client";

import { useEffect, useState } from "react";
import {
  listSceneVersions,
  getSceneVersionContent,
  restoreSceneVersion,
  type SceneVersion,
} from "@/server/versions";

/** Split a doc into an array of block-level paragraph strings. */
function paragraphs(doc: unknown): string[] {
  const out: string[] = [];
  const node = doc as { content?: unknown[] } | null;
  const blocks = Array.isArray(node?.content) ? node!.content : [];
  for (const b of blocks) {
    let t = "";
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const nn = n as { type?: string; text?: string; content?: unknown[] };
      if (nn.type === "text" && typeof nn.text === "string") t += nn.text;
      if (Array.isArray(nn.content)) nn.content.forEach(walk);
    };
    walk(b);
    out.push(t.trim());
  }
  return out;
}

type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Paragraph-level LCS diff so the history shows *what changed*, not the whole text. */
function diffParagraphs(oldP: string[], newP: string[]): DiffPart[] {
  const n = oldP.length;
  const m = newP.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldP[i] === newP[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldP[i] === newP[j]) {
      out.push({ type: "same", text: newP[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: oldP[i] });
      i++;
    } else {
      out.push({ type: "add", text: newP[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: oldP[i++] });
  while (j < m) out.push({ type: "add", text: newP[j++] });
  return out;
}

/** Collapse long runs of unchanged paragraphs to keep focus on changes. */
function collapse(parts: DiffPart[]): (DiffPart | { type: "gap"; text: string })[] {
  const result: (DiffPart | { type: "gap"; text: string })[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (p.type !== "same") {
      result.push(p);
      continue;
    }
    // Keep one line of context around changes; collapse the rest.
    const prevChanged = k > 0 && parts[k - 1].type !== "same";
    const nextChanged = k < parts.length - 1 && parts[k + 1].type !== "same";
    if (prevChanged || nextChanged) {
      result.push(p);
    } else {
      const last = result[result.length - 1];
      if (last && last.type === "gap") continue;
      result.push({ type: "gap", text: "···" });
    }
  }
  return result;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A Google-Docs-style version history drawer for a single scene. */
export function SceneHistory({
  sceneId,
  sceneTitle,
  onClose,
  onRestore,
}: {
  sceneId: string;
  sceneTitle: string;
  onClose: () => void;
  onRestore: (content: unknown) => void;
}) {
  const [versions, setVersions] = useState<SceneVersion[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<(DiffPart | { type: "gap"; text: string })[] | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const v = await listSceneVersions(sceneId);
        setVersions(v);
        if (v[0]) void choose(v, 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load history");
        setVersions([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  /** Show what changed *in* the version at `index` (vs the older one before it). */
  async function choose(list: SceneVersion[], index: number) {
    const v = list[index];
    if (!v) return;
    setSelected(v.id);
    setDiff(null);
    setLoadingDiff(true);
    try {
      const older = list[index + 1]; // versions are newest-first
      const [newContent, oldContent] = await Promise.all([
        getSceneVersionContent(v.id),
        older ? getSceneVersionContent(older.id) : Promise.resolve(null),
      ]);
      const parts = diffParagraphs(
        oldContent ? paragraphs(oldContent) : [],
        paragraphs(newContent),
      );
      setDiff(collapse(parts));
    } catch {
      setDiff([{ type: "same", text: "(couldn't load this version)" }]);
    } finally {
      setLoadingDiff(false);
    }
  }

  async function restore() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const { content } = await restoreSceneVersion(selected);
      onRestore(content);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[420px] max-w-[90vw] bg-[var(--wc-surface)] border-l border-[var(--wc-border)] shadow-2xl flex flex-col">
        <header className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--wc-faint)]">
              Version history
            </div>
            <div className="font-serif text-base text-[var(--wc-ink)] truncate">{sceneTitle}</div>
          </div>
          <button onClick={onClose} className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] text-lg px-1">
            ×
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800">{error}</div>
        )}

        <div className="flex-1 overflow-hidden grid grid-rows-[auto_1fr]">
          <div className="max-h-44 overflow-y-auto border-b border-[var(--wc-border)]">
            {versions === null ? (
              <div className="p-4 text-sm text-[var(--wc-faint)]">Loading…</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-sm text-[var(--wc-faint)]">
                No saved versions yet. Versions are captured automatically as you write.
              </div>
            ) : (
              <ul>
                {versions.map((v, i) => {
                  const prev = versions[i + 1];
                  const delta = prev ? v.word_count - prev.word_count : v.word_count;
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => choose(versions, i)}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                          selected === v.id ? "bg-[var(--wc-paper)]" : "hover:bg-[var(--wc-canvas)]"
                        }`}
                      >
                        <span className="text-[var(--wc-ink)]">
                          {when(v.created_at)}
                          {i === 0 && <span className="ml-2 text-[10px] text-[var(--wc-faint)]">latest</span>}
                        </span>
                        <span
                          className={`text-[11px] ${
                            delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-[var(--wc-faint)]"
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta} words
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="overflow-y-auto p-4">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">
              What changed in this version
            </div>
            {loadingDiff || diff === null ? (
              <p className="text-sm text-[var(--wc-faint)]">Loading…</p>
            ) : diff.length === 0 ? (
              <p className="text-sm text-[var(--wc-faint)]">No text in this version.</p>
            ) : diff.every((d) => d.type === "same" || d.type === "gap") ? (
              <p className="text-sm text-[var(--wc-faint)]">No changes from the previous version.</p>
            ) : (
              <div className="space-y-2 font-serif text-sm leading-relaxed">
                {diff.map((d, idx) =>
                  d.type === "gap" ? (
                    <div key={idx} className="text-center text-[var(--wc-faint)] select-none">···</div>
                  ) : d.type === "add" ? (
                    <p key={idx} className="rounded bg-emerald-50 border-l-2 border-emerald-500 px-2 py-1 text-emerald-900">
                      {d.text || "(blank line)"}
                    </p>
                  ) : d.type === "del" ? (
                    <p key={idx} className="rounded bg-red-50 border-l-2 border-red-400 px-2 py-1 text-red-900 line-through">
                      {d.text || "(blank line)"}
                    </p>
                  ) : (
                    <p key={idx} className="text-[var(--wc-muted)]">{d.text}</p>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-[var(--wc-border)] p-3 flex justify-end">
          <button
            onClick={restore}
            disabled={!selected || busy}
            className="rounded-md bg-[var(--wc-slate)] px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Restoring…" : "Restore this version"}
          </button>
        </footer>
      </div>
    </div>
  );
}
