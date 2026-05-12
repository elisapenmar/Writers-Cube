import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChapterReader } from "@/components/chapter-reader";

type Scene = {
  id: string;
  title: string;
  content: unknown;
  word_count: number;
};

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) notFound();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("id, title, content, word_count")
    .eq("chapter_id", chapter.id)
    .order("position", { ascending: true });

  const sceneList = (scenes ?? []) as Scene[];
  const totalWords = sceneList.reduce((sum, s) => sum + (s.word_count ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Chapter
          </div>
          <h1 className="font-serif text-lg">{chapter.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>
            {sceneList.length} scene{sceneList.length === 1 ? "" : "s"}
          </span>
          <span>{totalWords} words</span>
          {sceneList[0] && (
            <Link
              href={`/app/scene/${sceneList[0].id}`}
              className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
            >
              Edit scene by scene
            </Link>
          )}
        </div>
      </header>
      {sceneList.length === 0 ? (
        <div className="flex-1 grid place-items-center text-zinc-400">
          <p className="text-sm">No scenes in this chapter yet.</p>
        </div>
      ) : (
        <ChapterReader
          scenes={sceneList.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content as never,
          }))}
        />
      )}
    </div>
  );
}
