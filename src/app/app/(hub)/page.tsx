import Link from "next/link";
import {
  listProjects,
  getActiveProjectId,
  openProject,
  createProjectAndOpen,
} from "@/server/projects";
import { listExercises, type ExerciseSummary } from "@/server/prompts";
import { listKernels, type StoryKernel } from "@/server/kernels";
import { ExerciseCard } from "@/components/exercise-card";
import { StoryKernels } from "@/components/story-kernels";

async function safeExercises(projectId: string | null): Promise<ExerciseSummary[]> {
  try {
    return await listExercises(projectId);
  } catch {
    return [];
  }
}

async function safeKernels(): Promise<StoryKernel[]> {
  try {
    return await listKernels();
  } catch {
    return [];
  }
}

export default async function Dashboard() {
  const [projects, activeProjectId] = await Promise.all([
    listProjects(),
    getActiveProjectId(),
  ]);
  const active =
    projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const [practice, storyExercises, kernels] = await Promise.all([
    safeExercises(null),
    active ? safeExercises(active.id) : Promise.resolve([]),
    safeKernels(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <section className="rounded-3xl p-6 sm:p-8 wc-paper border border-[rgba(33,31,41,0.08)] shadow-[0_8px_30px_rgba(33,31,41,0.06)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-[var(--wc-ink)]">
              Writing Prompts
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              Roll your way out of the block — a replayable warm-up, or prompts
              dug straight out of your own draft.
            </p>
          </div>
          <Link
            href="/app/prompts"
            className="shrink-0 rounded-2xl px-6 py-3 text-white font-medium shadow-lg text-center"
            style={{ background: "var(--wc-terracotta)" }}
          >
            🎲 Roll a prompt
          </Link>
        </section>

        {/* Projects */}
        <section>
          <h2 className="font-serif text-xl text-[var(--wc-ink)] mb-3">
            Your projects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <form key={p.id} action={openProject}>
                <input type="hidden" name="projectId" value={p.id} />
                <button
                  type="submit"
                  className={`w-full text-left rounded-2xl p-4 border bg-white hover:border-zinc-300 transition ${
                    active?.id === p.id
                      ? "border-[var(--wc-slate)]"
                      : "border-zinc-200"
                  }`}
                >
                  <div className="font-serif text-lg text-[var(--wc-ink)]">
                    {p.title}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {p.word_count.toLocaleString()} words · {p.chapter_count}{" "}
                    chapter{p.chapter_count === 1 ? "" : "s"}
                    {active?.id === p.id && " · open"}
                  </div>
                </button>
              </form>
            ))}

            <form
              action={createProjectAndOpen}
              className="rounded-2xl p-4 border border-dashed border-zinc-300 bg-transparent flex items-center gap-2"
            >
              <input
                name="title"
                placeholder="New project title…"
                className="flex-1 bg-white rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm text-white"
                style={{ background: "var(--wc-slate)" }}
              >
                Create
              </button>
            </form>
          </div>
        </section>

        {/* Story kernels */}
        <StoryKernels initial={kernels} />

        {/* Practice library */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-[var(--wc-ink)]">
              Practice library
            </h2>
            <Link href="/app/exercises" className="text-xs text-[var(--wc-slate)] hover:underline">
              View all →
            </Link>
          </div>
          {practice.length === 0 ? (
            <EmptyHint>
              Standalone warm-ups you write from{" "}
              <Link href="/app/prompts" className="text-[var(--wc-slate)] hover:underline">
                Writer&apos;s Cube
              </Link>{" "}
              land here.
            </EmptyHint>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {practice.slice(0, 4).map((ex) => (
                <ExerciseCard key={ex.id} exercise={ex} />
              ))}
            </div>
          )}
        </section>

        {/* Project's prompted exercises */}
        {active && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-[var(--wc-ink)]">
                Prompted exercises · {active.title}
              </h2>
              <Link
                href={`/app/exercises?project=${active.id}`}
                className="text-xs text-[var(--wc-slate)] hover:underline"
              >
                View all →
              </Link>
            </div>
            {storyExercises.length === 0 ? (
              <EmptyHint>
                Prompts grounded in this story (via{" "}
                <Link href="/app/prompts" className="text-[var(--wc-slate)] hover:underline">
                  Help me with my story
                </Link>
                ) are saved here, attached to the project.
              </EmptyHint>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {storyExercises.slice(0, 4).map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-zinc-500 rounded-2xl border border-dashed border-zinc-300 px-4 py-5">
      {children}
    </p>
  );
}
