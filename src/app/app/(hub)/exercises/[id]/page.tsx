import Link from "next/link";
import { notFound } from "next/navigation";
import { getExercise } from "@/server/prompts";
import { listProjects } from "@/server/projects";
import { DeleteExerciseButton } from "@/components/delete-exercise-button";
import { ExerciseEditor } from "@/components/exercise-editor";
import { MoveExerciseControl } from "@/components/move-exercise-control";

export default async function ExerciseView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ex, projects] = await Promise.all([
    getExercise(id).catch(() => null),
    listProjects(),
  ]);
  if (!ex) notFound();

  const backHref = ex.project_id
    ? `/app/exercises?project=${ex.project_id}`
    : "/app/exercises";

  const promptText = [
    ex.prompt?.text,
    ex.prompt?.question,
    ex.prompt?.constraint ? `Constraint: ${ex.prompt.constraint}` : null,
  ]
    .filter(Boolean)
    .join("  ");

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href={backHref} className="text-xs text-[var(--wc-slate)] hover:underline">
            ← {ex.project_id ? "Prompted exercises" : "Practice library"}
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span>{ex.format === "seed" ? "Scenario seed" : "Craft exercise"}</span>
            <span>·</span>
            <span>{ex.focus}</span>
            <span>·</span>
            <span>{ex.depth === "deep" ? "Deep dive" : "Warm-up"}</span>
          </div>
        </div>

        <div className="mt-4">
          <ExerciseEditor
            id={ex.id}
            initialTitle={ex.title ?? ""}
            initialContent={ex.content}
            promptText={promptText}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-3">
          <MoveExerciseControl
            exerciseId={ex.id}
            currentProjectId={ex.project_id}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Moving it into a project files it under that project&apos;s{" "}
            <b>Unorganized</b> scenes in the sidebar.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/app/prompts"
            className="rounded-xl px-4 py-2 text-sm text-white"
            style={{ background: "var(--wc-terracotta)" }}
          >
            Roll a new prompt
          </Link>
          <DeleteExerciseButton id={ex.id} backHref={backHref} />
        </div>
      </div>
    </div>
  );
}
