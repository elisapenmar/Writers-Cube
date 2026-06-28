import Link from "next/link";
import {
  listProjects,
  listFolders,
  getActiveProjectId,
  type ProjectFolder,
} from "@/server/projects";
import { listExercises, type ExerciseSummary } from "@/server/prompts";
import { listKernels, type StoryKernel } from "@/server/kernels";
import { listInspirations, type Inspiration } from "@/server/inspirations";
import { PracticeLibrary } from "@/components/practice-library";
import { StoryKernels } from "@/components/story-kernels";
import { Inspirations } from "@/components/inspirations";
import { ProjectsSection } from "@/components/projects-section";
import { WelcomeModal } from "@/components/welcome-modal";
import { CubeMark } from "@/components/cube-mark";
import { CubeField } from "@/components/cube-field";
import { DashboardTour } from "@/components/dashboard-tour";

const PROJECTS_PREVIEW = 6;
const KERNELS_PREVIEW = 3;
const INSPIRATIONS_PREVIEW = 3;

async function safeFolders(): Promise<ProjectFolder[]> {
  try {
    return await listFolders();
  } catch {
    return [];
  }
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

  const [practice, kernels, inspirations, folders] = await Promise.all([
    safeExercises(null),
    safeKernels(),
    safeInspirations(),
    safeFolders(),
  ]);

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
          <ProjectsSection
            projects={projects}
            folders={folders}
            activeId={active?.id ?? null}
            previewLimit={PROJECTS_PREVIEW}
          />
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
        <PracticeLibrary practice={practice} />
      </div>
    </div>
  );
}
