import { getOrCreateProject } from "@/server/scenes";
import { listLooseScenes } from "@/server/loose";
import { listExercises } from "@/server/prompts";
import {
  ManuscriptReader,
  type ManuscriptChapter,
  type ManuscriptScene,
} from "@/components/manuscript-reader";

/** All uncategorized items (loose scenes + project exercises) for the scroll. */
async function uncategorizedScenes(projectId: string): Promise<ManuscriptScene[]> {
  const out: ManuscriptScene[] = [];
  try {
    const loose = await listLooseScenes(projectId);
    for (const l of loose) {
      out.push({ id: l.id, title: l.title, content: l.content, kind: "loose" });
    }
  } catch {
    /* table may be missing */
  }
  try {
    const exercises = await listExercises(projectId);
    for (const e of exercises) {
      out.push({
        id: e.id,
        title: e.title?.trim() || e.prompt?.text || "Untitled exercise",
        content: e.content,
        kind: "exercise",
      });
    }
  } catch {
    /* table may be missing */
  }
  return out;
}

export default async function ManuscriptPage() {
  const project = await getOrCreateProject();
  const chapters: ManuscriptChapter[] = project.chapters.map((c) => ({
    id: c.id,
    title: c.title,
    scenes: c.scenes.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
    })),
  }));
  const looseScenes = await uncategorizedScenes(project.id);
  return (
    <ManuscriptReader
      projectTitle={project.title}
      chapters={chapters}
      looseScenes={looseScenes}
    />
  );
}
