import Link from "next/link";
import type { ExerciseSummary } from "@/server/prompts";

const FOCUS_LABEL: Record<string, string> = {
  character: "Character",
  setting: "Setting",
  plot: "Plot",
  voice: "Voice",
  dialogue: "Dialogue",
  sensory: "Sensory",
};

export function ExerciseCard({ exercise }: { exercise: ExerciseSummary }) {
  const d = new Date(exercise.created_at);
  const when = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  return (
    <Link
      href={`/app/exercises/${exercise.id}`}
      className="wc-card block p-4"
    >
      <div className="flex items-center gap-1.5 mb-2 text-[11px]">
        <span className="wc-badge" style={{ "--wc-tint": "var(--wc-slate)" } as React.CSSProperties}>
          {FOCUS_LABEL[exercise.focus] ?? exercise.focus}
        </span>
        <span
          className="wc-badge"
          style={{
            "--wc-tint":
              exercise.format === "seed" ? "var(--wc-plum)" : "var(--wc-clay)",
          } as React.CSSProperties}
        >
          {exercise.format === "seed" ? "Seed" : "Exercise"}
        </span>
        <span className="ml-auto text-zinc-400">{when}</span>
      </div>
      {exercise.title ? (
        <>
          <p className="font-serif text-base text-[var(--wc-ink)] leading-snug mb-0.5">
            {exercise.title}
          </p>
          <p className="text-xs text-zinc-500 leading-snug line-clamp-2">
            {exercise.prompt?.text}
          </p>
        </>
      ) : (
        <p className="font-serif text-sm text-zinc-800 leading-snug line-clamp-3">
          {exercise.prompt?.text}
        </p>
      )}
      <div className="mt-2 text-[11px] text-zinc-500">
        {exercise.word_count.toLocaleString()} words written ·{" "}
        {exercise.writing_mode === "typewriter" ? "Typewriter" : "Free write"}
      </div>
    </Link>
  );
}
