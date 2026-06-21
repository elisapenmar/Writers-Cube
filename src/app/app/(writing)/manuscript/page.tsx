import { getOrCreateProject } from "@/server/scenes";
import { listLooseScenes } from "@/server/loose";
import {
  ManuscriptReader,
  type ManuscriptChapter,
  type ManuscriptScene,
} from "@/components/manuscript-reader";

async function safeLooseScenes(projectId: string): Promise<ManuscriptScene[]> {
  try {
    const loose = await listLooseScenes(projectId);
    return loose.map((l) => ({
      id: l.id,
      title: l.title,
      content: l.content,
      loose: true,
    }));
  } catch {
    return [];
  }
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
  const looseScenes = await safeLooseScenes(project.id);
  return (
    <ManuscriptReader
      projectTitle={project.title}
      chapters={chapters}
      looseScenes={looseScenes}
    />
  );
}
