"use client";

import { useEffect, useState } from "react";
import {
  listSceneVersions,
  getSceneVersionContent,
  restoreSceneVersion,
  type SceneVersion,
} from "@/server/versions";

function plainText(doc: unknown): string {
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += node.text;
    if (node.type === "paragraph" || node.type === "heading") text += "\n\n";
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim();
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
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const v = await listSceneVersions(sceneId);
        setVersions(v);
        if (v[0]) void choose(v[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load history");
        setVersions([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  async function choose(id: string) {
    setSelected(id);
    setPreview("Loading…");
    try {
      const content = await getSceneVersionContent(id);
      setPreview(plainText(content) || "(empty)");
    } catch {
      setPreview("(couldn't load this version)");
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
                {versions.map((v, i) => (
                  <li key={v.id}>
                    <button
                      onClick={() => choose(v.id)}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                        selected === v.id ? "bg-[var(--wc-paper)]" : "hover:bg-[var(--wc-canvas)]"
                      }`}
                    >
                      <span className="text-[var(--wc-ink)]">
                        {when(v.created_at)}
                        {i === 0 && <span className="ml-2 text-[10px] text-[var(--wc-faint)]">latest</span>}
                      </span>
                      <span className="text-[11px] text-[var(--wc-faint)]">{v.word_count} words</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-y-auto p-4">
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-[var(--wc-muted)]">
              {preview}
            </pre>
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
