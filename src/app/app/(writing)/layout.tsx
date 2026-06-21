import { SideNav } from "@/components/side-nav";
import { AppShell } from "@/components/app-shell";
import { getOrCreateProject } from "@/server/scenes";
import { listExercises } from "@/server/prompts";

export default async function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();
  let unorganized: { id: string; title: string | null; promptText: string }[] = [];
  try {
    const exercises = await listExercises(project.id);
    unorganized = exercises.map((e) => ({
      id: e.id,
      title: e.title,
      promptText: e.prompt?.text ?? "",
    }));
  } catch {
    unorganized = [];
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <SideNav project={project} unorganized={unorganized} />
      <AppShell>{children}</AppShell>
    </div>
  );
}
