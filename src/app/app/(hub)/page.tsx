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
import { ImportButton } from "@/components/import-button";
import { ProjectExportMenu } from "@/components/project-export-menu";

const PROJECTS_PREVIEW = 3;
const KERNELS_PREVIEW = 3;

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

  const [practice, kernels] = await Promise.all([
    safeExercises(null),
    safeKernels(),
  ]);

  const recentProjects = [...projects].reverse().slice(0, PROJECTS_PREVIEW);

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <section className="rounded-3xl p-6 sm:p-8 wc-paper border border-[rgba(51,48,58,0.07)] shadow-[0_10px_34px_rgba(51,48,58,0.05)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
              Writer&apos;s Cube
            </div>
            <h1 className="font-serif text-3xl text-[var(--wc-ink)] mt-1">
              Welcome back.
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              Pick up a project, capture a kernel, or roll a prompt to warm up.
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
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-[var(--wc-ink)]">
              Your projects
            </h2>
            {projects.length > PROJECTS_PREVIEW && (
              <Link href="/app/projects" className="text-xs text-[var(--wc-slate)] hover:underline">
                View all
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl p-4 border bg-white transition ${
                  active?.id === p.id ? "border-[var(--wc-slate)]" : "border-zinc-200"
                }`}
              >
                <form action={openProject}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <button type="submit" className="block w-full text-left pr-16">
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
                <div className="absolute top-3 right-3">
                  <ProjectExportMenu projectId={p.id} />
                </div>
              </div>
            ))}
          </div>

          {/* Compact: start a new project, or import one */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form
              action={createProjectAndOpen}
              className="flex-1 rounded-2xl p-2 border border-dashed border-zinc-300 bg-transparent flex items-center gap-2"
            >
              <input
                name="title"
                placeholder="New project title…"
                className="flex-1 bg-white rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2 text-sm text-white"
                style={{ background: "var(--wc-slate)" }}
              >
                Create
              </button>
            </form>
            <ImportButton />
          </div>
        </section>

        {/* Story kernels */}
        <StoryKernels initial={kernels} limit={KERNELS_PREVIEW} />

        {/* Practice library */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-[var(--wc-ink)]">
              Practice library
            </h2>
            <Link href="/app/exercises" className="text-xs text-[var(--wc-slate)] hover:underline">
              View all
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
