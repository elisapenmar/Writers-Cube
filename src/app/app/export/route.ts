import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type Manuscript,
  type ExportFormat,
  tiptapToParagraphs,
  renderManuscript,
  safeName,
} from "@/lib/manuscript-export";
import { getActiveProjectId } from "@/server/projects";
import { getPublishSettings } from "@/server/publish";

// EPUB/DOCX rendering can take a moment — allow up to 60s on Vercel.
export const maxDuration = 60;

const VALID: ExportFormat[] = ["md", "txt", "html", "docx", "epub", "pdf"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const fmtParam = (request.nextUrl.searchParams.get("format") ?? "md") as ExportFormat;
  const format: ExportFormat = VALID.includes(fmtParam) ? fmtParam : "md";

  // Resolve which project to export: explicit ?project, then active, then oldest.
  const requested = request.nextUrl.searchParams.get("project");
  const activeId = requested ?? (await getActiveProjectId());

  let projectQuery = supabase
    .from("projects")
    .select("id, title, author_name, agent_name")
    .eq("user_id", user.id);
  projectQuery = activeId
    ? projectQuery.eq("id", activeId)
    : projectQuery.order("created_at", { ascending: true }).limit(1);
  const { data: project } = await projectQuery.maybeSingle();
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

  // Publish settings drive the styled formats (epub, pdf, docx).
  const settings = await getPublishSettings(project.id);
  const { body, contentType, ext } = await renderManuscript(manuscript, format, settings);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeName(settings.title || project.title)}-${stamp}.${ext}`;

  // Print-ready HTML opens inline so the user can hit Save as PDF.
  const disposition =
    format === "pdf" ? "inline" : `attachment; filename="${filename}"`;

  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}
