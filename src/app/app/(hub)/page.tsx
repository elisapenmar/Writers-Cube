import Link from "next/link";
import {
  listProjects,
  getActiveProjectId,
  openProject,
  createProjectAndOpen,
} from "@/server/projects";
import { listExercises, type ExerciseSummary } from "@/server/prompts";
import { listKernels, type StoryKernel } from "@/server/kernels";
import { listInspirations, type Inspiration } from "@/server/inspirations";
import { ExerciseCard } from "@/components/exercise-card";
import { StoryKernels } from "@/components/story-kernels";
import { Inspirations } from "@/components/inspirations";
import { ImportButton } from "@/components/import-button";
import { ProjectExportMenu } from "@/components/project-export-menu";
import { ProjectGoal } from "@/components/project-goal";
import { WelcomeModal } from "@/components/welcome-modal";
import { CubeMark } from "@/components/cube-mark";
import { CubeField } from "@/components/cube-field";
import { DashboardTour } from "@/components/dashboard-tour";

const PROJECTS_PREVIEW = 6;
const KERNELS_PREVIEW = 3;
const INSPIRATIONS_PREVIEW = 3;

/** Compact "when was this last touched" label for a project card. */
function lastTouched(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  const sameYear = then.getFullYear() === new Date().getFullYear();
  return `Edited ${then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

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

async function safeInspirations(): Promise<Inspiration[]> {
  try {
    return await listInspirations();
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

  const [practice, kernels, inspirations] = await Promise.all([
    safeExercises(null),
    safeKernels(),
    safeInspirations(),
  ]);

  const recentProjects = [...projects].reverse().slice(0, PROJECTS_PREVIEW);

  // First time in: a brand-new account with nothing created yet is greeted with
  // "Welcome!"; once there's anything to come back to, it's "Welcome back."
  const isFirstTime =
    projects.length === 0 &&
    kernels.length === 0 &&
    practice.length === 0 &&
    inspirations.length === 0;

  return (
    <div className="relative flex-1 overflow-y-auto wc-cube-bg">
      <CubeField />
      <DashboardTour />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <section
          data-tour="dash-hero"
          className="wc-raised rounded-[var(--wc-r-lg)] px-5 py-3.5 sm:px-6 sm:py-4 flex flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <CubeMark size={26} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="font-serif text-xl sm:text-2xl text-[var(--wc-ink)] leading-tight">
                {isFirstTime ? "Welcome!" : "Welcome back."}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--wc-muted)] truncate">
                Pick up a project, capture a kernel, or roll a prompt.
              </p>
              <div className="mt-0.5">
                <WelcomeModal hasProjects={projects.length > 0} />
              </div>
            </div>
          </div>
          <Link
            href="/app/prompts"
            data-tour="dash-prompt"
            className="shrink-0 rounded-[var(--wc-r-md)] px-4 py-2.5 text-sm text-[var(--wc-on-accent)] font-medium text-center shadow-[var(--wc-shadow-sm)] transition hover:brightness-105"
            style={{ background: "var(--wc-clay)" }}
          >
            🎲 Roll a prompt
          </Link>
        </section>

        {/* Projects */}
        <section data-tour="dash-projects">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
              <span className="wc-facet" aria-hidden />
              Your projects
            </h2>
            <div className="flex items-center gap-3">
              {projects.length > PROJECTS_PREVIEW && (
                <Link href="/app/projects" className="text-xs text-[var(--wc-slate)] hover:underline">
                  View all
                </Link>
              )}
              <Link href="/app/archive" className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:underline">
                🗄 Archive
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                data-active={active?.id === p.id}
                className="wc-card relative p-4"
              >
                <form action={openProject}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <button type="submit" className="block w-full text-left pr-16">
                    <div className="font-serif text-lg text-[var(--wc-ink)]">
                      {p.title}
                    </div>
                    <div className="text-xs text-[var(--wc-faint)] mt-1">
                      {p.word_count.toLocaleString()} words · {p.chapter_count}{" "}
                      chapter{p.chapter_count === 1 ? "" : "s"}
                      {active?.id === p.id && " · open"}
                    </div>
                  </button>
                </form>
                <ProjectGoal
                  projectId={p.id}
                  wordCount={p.word_count}
                  initialGoal={p.word_goal}
                />
                <div className="absolute top-3 right-3">
                  <ProjectExportMenu projectId={p.id} />
                </div>
                <div className="absolute bottom-4 right-4 text-[10px] text-[var(--wc-faint)] pointer-events-none">
                  {lastTouched(p.updated_at)}
                </div>
              </div>
            ))}
          </div>

          {/* Compact: start a new project, or import one */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form
              action={createProjectAndOpen}
              className="flex-1 rounded-[var(--wc-r-lg)] p-2 border border-dashed border-[var(--wc-border-strong)] bg-transparent flex items-center gap-2"
            >
              <input
                name="title"
                placeholder="New project title…"
                className="flex-1 bg-[var(--wc-surface)] rounded-[var(--wc-r-md)] border border-[var(--wc-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--wc-slate)]"
              />
              <select
                name="form"
                defaultValue="novel"
                title="What are you writing?"
                className="bg-[var(--wc-surface)] rounded-[var(--wc-r-md)] border border-[var(--wc-border)] px-2 py-2 text-sm focus:outline-none focus:border-[var(--wc-slate)]"
              >
                <option value="novel">Novel</option>
                <option value="short_story">Short story</option>
                <option value="poetry">Poetry</option>
                <option value="essay">Essay / Article</option>
              </select>
              <button
                type="submit"
                className="rounded-[var(--wc-r-md)] px-4 py-2 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105"
                style={{ background: "var(--wc-slate)" }}
              >
                Create
              </button>
            </form>
            <ImportButton />
          </div>
        </section>

        {/* Story kernels */}
        <div data-tour="dash-kernels">
          <StoryKernels initial={kernels} limit={KERNELS_PREVIEW} />
        </div>

        {/* Inspiration */}
        <div data-tour="dash-inspirations">
          <Inspirations initial={inspirations} limit={INSPIRATIONS_PREVIEW} />
        </div>

        {/* Practice library */}
        <section data-tour="dash-practice">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
              <span className="wc-facet" aria-hidden />
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
    <p className="text-sm text-[var(--wc-muted)] rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-5">
      {children}
    </p>
  );
}
