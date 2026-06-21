import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type Manuscript,
  type ExportFormat,
  tiptapToParagraphs,
  renderManuscript,
  safeName,
} from "@/lib/manuscript-export";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const fmtParam = (request.nextUrl.searchParams.get("format") ?? "md") as ExportFormat;
  const format: ExportFormat = ["md", "txt", "html", "docx"].includes(fmtParam)
    ? fmtParam
    : "md";

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, author_name, agent_name")
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
        .select("id, chapter_id, title, position, content, word_count")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] };

  let totalWords = 0;
  const manuscript: Manuscript = {
    title: project.title,
    author: project.author_name ?? null,
    agent: project.agent_name ?? null,
    totalWords: 0,
    chapters: (chapters ?? []).map((c) => ({
      title: c.title,
      scenes: (scenes ?? [])
        .filter((s) => s.chapter_id === c.id)
        .map((s) => {
          totalWords += s.word_count ?? 0;
          return { title: s.title, paragraphs: tiptapToParagraphs(s.content) };
        }),
    })),
  };
  manuscript.totalWords = totalWords;

  const { body, contentType, ext } = await renderManuscript(manuscript, format);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeName(project.title)}-${stamp}.${ext}`;

  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
