import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";

function safeName(s: string) {
  return s.replace(/[/\\:*?"<>|]/g, "_").trim() || "Untitled";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, author_name, agent_name, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!project) return new NextResponse("No project", { status: 404 });

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const chapterIds = (chapters ?? []).map((c) => c.id);
  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, title, position, content, word_count, updated_at")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] };

  const lines: string[] = [];
  lines.push(`# ${project.title}`);
  if (project.author_name) lines.push(`\n*by ${project.author_name}*`);
  if (project.agent_name) lines.push(`\n*Agent: ${project.agent_name}*`);
  lines.push("");

  let totalWords = 0;

  for (const [ci, chapter] of (chapters ?? []).entries() as IterableIterator<
    [number, { id: string; title: string }]
  >) {
    const chapterScenes = (scenes ?? []).filter((s) => s.chapter_id === chapter.id);
    lines.push("\n\n---\n");
    lines.push(`## Chapter ${ci + 1} — ${chapter.title}\n`);
    chapterScenes.forEach((scene, si) => {
      if (si > 0) lines.push("\n\\* \\* \\*\n");
      const body = tiptapToMarkdown(scene.content).trim();
      lines.push(body);
      totalWords += scene.word_count ?? 0;
    });
  }

  lines.push("\n\n*The End*\n");
  lines.push(`\n<!-- exported ${new Date().toISOString()} · ${totalWords} words -->`);

  const md = lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeName(project.title)}-${stamp}.md`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
