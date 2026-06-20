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
      className="block rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition"
    >
      <div className="flex items-center gap-1.5 mb-2 text-[11px]">
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{ color: "var(--wc-slate)", background: "rgba(62,92,118,0.1)" }}
        >
          {FOCUS_LABEL[exercise.focus] ?? exercise.focus}
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{
            color: exercise.format === "seed" ? "var(--wc-plum)" : "var(--wc-terracotta)",
            background:
              exercise.format === "seed"
                ? "rgba(106,85,127,0.1)"
                : "rgba(217,105,76,0.1)",
          }}
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
