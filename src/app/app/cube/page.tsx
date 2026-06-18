import { listProjects, getActiveProjectId } from "@/server/projects";
import { PromptTool } from "@/components/prompt-tool";

export default async function CubePage() {
  const [projects, activeProjectId] = await Promise.all([
    listProjects(),
    getActiveProjectId(),
  ]);
  return (
    <PromptTool
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      activeProjectId={activeProjectId}
    />
  );
}
