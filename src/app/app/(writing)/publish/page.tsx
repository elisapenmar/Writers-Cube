import { getOrCreateProject } from "@/server/scenes";
import { getPublishSettings } from "@/server/publish";
import { tiptapToParagraphs } from "@/lib/manuscript-export";
import { PublishStudio, type PublishSample } from "@/components/publish-studio";
import { withDefaults } from "@/lib/publish-types";

export default async function PublishPage() {
  const project = await getOrCreateProject();

  let settings = withDefaults(null);
  try {
    settings = await getPublishSettings(project.id);
  } catch {
    // column missing → fall back to defaults seeded from the project
    settings.title = project.title;
    settings.author = project.author_name ?? undefined;
  }
  if (!settings.title) settings.title = project.title;
  if (!settings.author && project.author_name) settings.author = project.author_name;

  // A small sample for the live preview: first chapter's opening.
  const firstChapter = project.chapters[0];
  const firstScene = firstChapter?.scenes[0];
  const sampleParas = firstScene ? tiptapToParagraphs(firstScene.content).slice(0, 4) : [];
  const sample: PublishSample = {
    chapterTitle: firstChapter?.title ?? "Chapter One",
    paragraphs:
      sampleParas.length > 0
        ? sampleParas
        : [
            "Your manuscript will appear here once you start writing. This preview reflects the typography and layout choices you make below.",
            "Adjust the font, spacing, indentation, and chapter style — then export to ebook, print, or Word.",
          ],
  };

  return (
    <PublishStudio
      projectId={project.id}
      projectTitle={project.title}
      initial={settings}
      sample={sample}
    />
  );
}
