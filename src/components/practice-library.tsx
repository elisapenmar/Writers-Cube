"use client";

import Link from "next/link";
import { ExerciseCard } from "@/components/exercise-card";
import { ViewToggle } from "@/components/view-toggle";
import { useViewMode } from "@/store/view-mode-store";
import type { ExerciseSummary } from "@/server/prompts";

/** Practice library section: same header pattern as the other dashboard
 *  sections — section marker + card/list toggle, then a "Roll a prompt" /
 *  "View all" action row, then the exercises. */
export function PracticeLibrary({ practice }: { practice: ExerciseSummary[] }) {
  const [mode, setMode] = useViewMode("practice");
  const visible = practice.slice(0, 4);

  return (
    <section data-tour="dash-practice">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
          <span className="wc-facet" aria-hidden />
          Practice library
        </h2>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href="/app/prompts"
          className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105"
          style={{ background: "var(--wc-clay)" }}
        >
          🎲 Roll a prompt
        </Link>
        <Link
          href="/app/exercises"
          className="rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] px-3 py-1.5 text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        >
          View all
        </Link>
      </div>

      {practice.length === 0 ? (
        <p className="text-sm text-[var(--wc-muted)] rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-5">
          Standalone warm-ups you write from{" "}
          <Link href="/app/prompts" className="text-[var(--wc-slate)] hover:underline">
            Writer&apos;s Cube
          </Link>{" "}
          land here.
        </p>
      ) : mode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--wc-border)] rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)]">
          {visible.map((ex) => (
            <li key={ex.id} className="flex items-center gap-3 px-3 py-2">
              <Link href={`/app/exercises/${ex.id}`} className="min-w-0 flex-1 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-serif text-[var(--wc-ink)]">{ex.title || ex.prompt.text}</span>
                <span className="shrink-0 text-xs text-[var(--wc-faint)]">
                  {ex.word_count.toLocaleString()} words
                </span>
              </Link>
              <Link
                href={`/app/exercises/${ex.id}`}
                className="shrink-0 text-[11px] text-[var(--wc-slate)] hover:underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
