import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { extractTags } from "@/lib/extract-tags";
import { TAG_KINDS, TAG_LABELS, TAG_COLORS, type TagKind } from "@/lib/tags";
import { TagRow } from "@/components/tag-row";

export default async function TagsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!project) return null;

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const chapterIds = (chapters ?? []).map((c) => c.id);
  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, title, position, content")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] };

  const chapterById = new Map((chapters ?? []).map((c) => [c.id, c]));

  type Row = {
    kind: TagKind;
    sentence: string;
    tagOffsetInSentence: number;
    tagLengthInSentence: number;
    blockIndex: number;
    sentenceStart: number;
    sentenceEnd: number;
    sceneId: string;
    sceneTitle: string;
    chapterTitle: string;
  };
  const rows: Row[] = [];
  for (const scene of scenes ?? []) {
    const passages = extractTags(scene.content);
    for (const p of passages) {
      rows.push({
        ...p,
        sceneId: scene.id,
        sceneTitle: scene.title,
        chapterTitle: chapterById.get(scene.chapter_id)?.title ?? "?",
      });
    }
  }

  const byKind = new Map<TagKind, Row[]>();
  for (const r of rows) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push(r);
    byKind.set(r.kind, arr);
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl">Tags</h1>
        <p className="text-sm text-zinc-500">
          {rows.length} passage{rows.length === 1 ? "" : "s"} tagged across the project
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 max-w-prose">
          No tags yet. Select text in any scene and click one of the tag buttons in
          the floating menu (Look up, Revise, Weak, Fact check, Placeholder) to mark
          it for later attention.
        </p>
      ) : (
        <div className="space-y-10 max-w-3xl">
          {TAG_KINDS.map((kind) => {
            const list = byKind.get(kind) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={kind}>
                <h2
                  className="font-serif text-lg mb-3 flex items-center gap-2"
                  style={{ color: TAG_COLORS[kind].swatch }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: TAG_COLORS[kind].swatch }}
                  />
                  {TAG_LABELS[kind]}
                  <span className="text-xs text-zinc-400 font-sans">({list.length})</span>
                </h2>
                <ul className="space-y-2">
                  {list.map((r, i) => (
                    <TagRow key={`${r.sceneId}-${r.blockIndex}-${r.sentenceStart}-${i}`} {...r} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
