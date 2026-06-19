import { notFound } from "next/navigation";
import { Editor } from "@/components/editor";
import { createClient } from "@/lib/supabase/server";
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

  return <Editor scene={scene as Scene} />;
}
