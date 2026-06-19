import Link from "next/link";
import { listExercises, type ExerciseSummary } from "@/server/prompts";
import { listProjects } from "@/server/projects";
import { ExerciseCard } from "@/components/exercise-card";

async function safeExercises(projectId: string | null): Promise<ExerciseSummary[]> {
  try {
    return await listExercises(projectId);
  } catch {
    return [];
  }
}

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const projectFilter = project ?? null;
  const [exercises, projects] = await Promise.all([
    safeExercises(projectFilter),
    listProjects(),
  ]);
  const projectTitle = projectFilter
    ? projects.find((p) => p.id === projectFilter)?.title ?? "this story"
    : null;

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/app" className="text-xs text-[var(--wc-slate)] hover:underline">
              ← Dashboard
            </Link>
            <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">
              {projectFilter
                ? `Prompted exercises · ${projectTitle}`
                : "Practice library"}
            </h1>
            <p className="text-sm text-zinc-600">
              {projectFilter
                ? "Grounded prompts written for this story."
                : "Your standalone warm-ups, not tied to any project."}
            </p>
          </div>
          <Link
            href="/app/prompts"
            className="shrink-0 rounded-xl px-4 py-2 text-white text-sm"
            style={{ background: "var(--wc-terracotta)" }}
          >
            🎲 New prompt
          </Link>
        </div>

        {exercises.length === 0 ? (
          <p className="text-sm text-zinc-500 rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center">
            Nothing here yet. Roll a prompt in{" "}
            <Link href="/app/prompts" className="text-[var(--wc-slate)] hover:underline">
              Writer&apos;s Cube
            </Link>{" "}
            and save what you write.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exercises.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
