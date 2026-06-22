import { SideNav, type UncategorizedItem } from "@/components/side-nav";
import { AppShell } from "@/components/app-shell";
import { StudioTour } from "@/components/studio-tour";
import { getOrCreateProject } from "@/server/scenes";
import { listExercises } from "@/server/prompts";
import { listLooseScenes } from "@/server/loose";

// Allow AI server actions invoked from these pages up to 60s on Vercel.
export const maxDuration = 60;

export default async function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();
  const uncategorized: UncategorizedItem[] = [];
  try {
    const loose = await listLooseScenes(project.id);
    for (const l of loose) {
      uncategorized.push({ id: l.id, kind: "loose", title: l.title });
    }
  } catch {
    /* table may be missing */
  }
  try {
    const exercises = await listExercises(project.id);
    for (const e of exercises) {
      uncategorized.push({
        id: e.id,
        kind: "exercise",
        title: e.title?.trim() || e.prompt?.text || "Untitled exercise",
      });
    }
  } catch {
    /* table may be missing */
  }

  return (
    <div className="wc-workspace flex flex-1 min-h-screen">
      <SideNav project={project} uncategorized={uncategorized} />
      <AppShell>{children}</AppShell>
      <StudioTour />
    </div>
  );
}
