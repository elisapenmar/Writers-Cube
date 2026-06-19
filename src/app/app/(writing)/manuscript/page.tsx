import { getOrCreateProject } from "@/server/scenes";
import {
  ManuscriptReader,
  type ManuscriptChapter,
} from "@/components/manuscript-reader";

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
  return <ManuscriptReader projectTitle={project.title} chapters={chapters} />;
}
