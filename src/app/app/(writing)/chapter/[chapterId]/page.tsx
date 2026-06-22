import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ManuscriptReader,
  type ManuscriptChapter,
} from "@/components/manuscript-reader";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, project_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) notFound();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("id, title, content, position")
    .eq("chapter_id", chapter.id)
    .order("position", { ascending: true });

  const chapters: ManuscriptChapter[] = [
    {
      id: chapter.id as string,
      title: chapter.title as string,
      scenes: (scenes ?? []).map((s) => ({
        id: s.id as string,
        title: s.title as string,
        content: s.content,
        chapterId: chapter.id as string,
      })),
    },
  ];

  return (
    <ManuscriptReader
      projectId={chapter.project_id as string}
      projectTitle={chapter.title as string}
      chapters={chapters}
    />
  );
}
