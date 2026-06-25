"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrganize } from "@/store/organize-store";
import { listLinkTargets, type LinkTargets } from "@/server/refs";

export type EntityRefs = {
  scene?: { id: string; title: string } | null;
  characters?: { id: string; name: string }[];
};

/**
 * Compact control for linking a timeline event / outline node to a story moment
 * (scene) and characters. Scene links jump to the manuscript; character chips
 * open the Story Bible → Characters panel and scroll to the card.
 */
export function EntityLinker({
  value,
  onChange,
}: {
  value: EntityRefs;
  onChange: (next: EntityRefs) => void;
}) {
  const openCharacter = useOrganize((s) => s.openCharacter);
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<LinkTargets | null>(null);
  const [loading, setLoading] = useState(false);

  const characters = value.characters ?? [];

  async function togglePicker() {
    const next = !open;
    setOpen(next);
    if (next && !targets && !loading) {
      setLoading(true);
      try {
        setTargets(await listLinkTargets());
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1">
        {value.scene && (
          <Link
            href={`/app/scene/${value.scene.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 rounded bg-[var(--wc-paper)] px-1.5 py-0.5 text-[10px] text-[var(--wc-slate)] hover:underline"
            title="Open this scene"
          >
            ◆ {value.scene.title} ↗
          </Link>
        )}
        {characters.map((c) => (
          <button
            key={c.id}
            onClick={() => openCharacter(c.id)}
            className="inline-flex items-center gap-0.5 rounded bg-[var(--wc-paper)] px-1.5 py-0.5 text-[10px] text-[var(--wc-plum)] hover:underline"
            title="Open this character card"
          >
            ◑ {c.name}
          </button>
        ))}
        <button
          onClick={togglePicker}
          className="rounded px-1 text-[10px] text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          title="Link a scene or character"
        >
          🔗
        </button>
      </div>
      {open && (
        <div className="mt-1 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-2 text-[11px] space-y-2 shadow-sm">
          {loading || !targets ? (
            <p className="text-[var(--wc-faint)]">Loading…</p>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--wc-faint)] mb-1">
                  Story moment
                </div>
                <select
                  value={value.scene?.id ?? ""}
                  onChange={(e) => {
                    const s = targets.scenes.find((x) => x.id === e.target.value);
                    onChange({ ...value, scene: s ? { id: s.id, title: s.title } : null });
                  }}
                  className="w-full rounded border border-[var(--wc-border)] bg-[var(--wc-surface)] px-1 py-0.5 text-[11px]"
                >
                  <option value="">(none)</option>
                  {targets.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.chapter ? `${s.chapter} · ` : ""}
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--wc-faint)] mb-1">
                  Characters
                </div>
                {targets.characters.length === 0 ? (
                  <p className="text-[var(--wc-faint)]">No characters yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {targets.characters.map((c) => {
                      const on = characters.some((x) => x.id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() =>
                            onChange({
                              ...value,
                              characters: on
                                ? characters.filter((x) => x.id !== c.id)
                                : [...characters, { id: c.id, name: c.name }],
                            })
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] border ${
                            on
                              ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)] border-[var(--wc-slate)]"
                              : "border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[10px] text-[var(--wc-slate)] hover:underline"
              >
                Done
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
