"use client";

import { useEffect, useState } from "react";
import { listProjectTags, type TagRowData } from "@/server/tags";
import { ALL_TAG_KINDS, TAG_LABELS, TAG_COLORS, type TagKind } from "@/lib/tags";
import { TagRow } from "@/components/tag-row";

export function TagsTab() {
  const [rows, setRows] = useState<TagRowData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listProjectTags()
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load tags"));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="p-4 text-xs text-red-600">{error}</p>;
  if (!rows) return <p className="p-4 text-xs text-[var(--wc-faint)]">Loading tags…</p>;

  const byKind = new Map<TagKind, TagRowData[]>();
  for (const r of rows) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push(r);
    byKind.set(r.kind, arr);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="text-xs text-[var(--wc-faint)] mb-4">
        {rows.length} passage{rows.length === 1 ? "" : "s"} tagged across the project
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--wc-faint)]">
          No tags yet. Select text in a scene and use the floating menu (Look up, Revise,
          Weak, Fact check, Placeholder) to mark it for later.
        </p>
      ) : (
        <div className="space-y-6">
          {ALL_TAG_KINDS.map((kind) => {
            const list = byKind.get(kind) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={kind}>
                <h3
                  className="font-serif text-sm mb-2 flex items-center gap-2"
                  style={{ color: TAG_COLORS[kind].swatch }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: TAG_COLORS[kind].swatch }}
                  />
                  {TAG_LABELS[kind]}
                  <span className="text-xs text-[var(--wc-faint)] font-sans">({list.length})</span>
                </h3>
                <ul className="space-y-2">
                  {list.map((r, i) => (
                    <TagRow key={`${r.sceneId}-${r.blockIndex}-${r.sentenceStart}-${i}`} {...r} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
