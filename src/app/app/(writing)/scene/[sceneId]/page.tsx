import { notFound } from "next/navigation";
import { Editor } from "@/components/editor";
import { ActiveProjectSync } from "@/components/active-project-sync";
import { createClient } from "@/lib/supabase/server";
import { getActiveProjectId } from "@/server/projects";
import type { Scene } from "@/lib/types";

export default async function ScenePage({
  params,
}: {
  params: Promise<{ sceneId: string }>;
}) {
  const { sceneId } = await params;
  const supabase = await createClient();
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, chapter_id, title, position, content, word_count, updated_at")
    .eq("id", sceneId)
    .maybeSingle();

  if (!scene) notFound();

  // Resolve which project this scene belongs to so the side panel (which reads
  // the active-project cookie) stays in step with what's on screen.
  const [{ data: chapter }, activeId] = await Promise.all([
    supabase
      .from("chapters")
      .select("project_id")
      .eq("id", scene.chapter_id as string)
      .maybeSingle(),
    getActiveProjectId(),
  ]);
  const projectId = chapter?.project_id as string | undefined;

  return (
    <>
      {projectId && <ActiveProjectSync projectId={projectId} activeId={activeId} />}
      <Editor scene={scene as Scene} />
    </>
  );
}
