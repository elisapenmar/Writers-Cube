"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { characterChapterMatrix, type CharacterMatrix } from "@/server/characters";

function cellBg(count: number, max: number): string {
  if (count <= 0) return "transparent";
  const t = Math.min(1, count / Math.max(1, max));
  const pct = Math.round((0.15 + t * 0.7) * 100);
  return `color-mix(in srgb, var(--wc-slate) ${pct}%, transparent)`;
}

export function CharacterGrid({ refreshKey }: { refreshKey?: number }) {
  const [matrix, setMatrix] = useState<CharacterMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState(refreshKey);

  // Reset to the loading state when refreshKey changes, during render (React
  // docs pattern) rather than synchronously inside the effect.
  if (loadedKey !== refreshKey) {
    setLoadedKey(refreshKey);
    setMatrix(null);
  }

  useEffect(() => {
    let alive = true;
    characterChapterMatrix()
      .then((m) => alive && setMatrix(m))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed"));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <p className="text-xs text-red-600 px-1">{error}</p>;
  if (!matrix) return <p className="text-xs text-[var(--wc-faint)] px-1">Building grid…</p>;
  if (matrix.chapters.length === 0 || matrix.rows.length === 0) {
    return (
      <p className="text-xs text-[var(--wc-faint)] px-1 py-2">
        Add characters and write some chapters to see where each one appears.
      </p>
    );
  }

  const max = Math.max(1, ...matrix.rows.flatMap((r) => r.counts));

  return (
    <div className="overflow-x-auto border border-[var(--wc-border)] rounded-md">
      <table className="border-collapse text-[11px] w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--wc-surface)] text-left font-medium text-[var(--wc-faint)] px-2 py-1 border-b border-[var(--wc-border)]">
              Character
            </th>
            {matrix.chapters.map((c, i) => (
              <th
                key={c.id}
                title={c.title || `Chapter ${i + 1}`}
                className="px-1.5 py-1 border-b border-[var(--wc-border)] text-[var(--wc-faint)] font-normal text-center min-w-[1.6rem]"
              >
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.id}>
              <td
                className="sticky left-0 z-10 bg-[var(--wc-surface)] px-2 py-1 whitespace-nowrap text-[var(--wc-ink)] border-b border-[var(--wc-border)] max-w-[8rem] truncate"
                title={`${r.name}, ${r.total} mention${r.total === 1 ? "" : "s"} total`}
              >
                {r.name}
              </td>
              {r.counts.map((count, i) => {
                const scene = r.sceneByChapter[i];
                const inner = (
                  <div
                    className="w-full grid place-items-center"
                    style={{ background: cellBg(count, max), minHeight: "1.5rem" }}
                  >
                    {count > 0 ? (
                      <span className={count / max > 0.6 ? "text-[var(--wc-on-accent)]" : "text-[var(--wc-ink)]"}>
                        {count}
                      </span>
                    ) : (
                      ""
                    )}
                  </div>
                );
                return (
                  <td key={i} className="border-b border-l border-[var(--wc-border)] p-0 text-center">
                    {count > 0 && scene ? (
                      <Link
                        href={`/app/scene/${scene}`}
                        title={`${r.name} in chapter ${i + 1}: ${count} mention${count === 1 ? "" : "s"}. Open the scene.`}
                        className="block hover:brightness-95"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
