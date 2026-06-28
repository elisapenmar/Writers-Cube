import Link from "next/link";
import { SquareArrow } from "@/components/icons";
import { listProjects, listFolders, getActiveProjectId, type ProjectFolder } from "@/server/projects";
import { ProjectsBrowser } from "@/components/projects-browser";

async function safeFolders(): Promise<ProjectFolder[]> {
  try {
    return await listFolders();
  } catch {
    return [];
  }
}

export default async function ProjectsPage() {
  const [projects, activeProjectId, folders] = await Promise.all([
    listProjects(),
    getActiveProjectId(),
    safeFolders(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <Link href="/app" className="text-xs text-[var(--wc-faint)] hover:underline">
              <SquareArrow dir="left" className="inline-block align-[-3px] mr-1" /> Dashboard
            </Link>
            <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">All projects</h1>
          </div>
        </div>

        <ProjectsBrowser
          projects={projects}
          folders={folders}
          activeId={activeProjectId}
        />
      </div>
    </div>
  );
}
