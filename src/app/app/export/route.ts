import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

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
    .select("id, title, updated_at")
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

  const zip = new JSZip();
  const root = zip.folder(safeName(project.title)) ?? zip;

  const manifest = {
    project: { id: project.id, title: project.title },
    exportedAt: new Date().toISOString(),
    chapters: (chapters ?? []).map((c, ci) => ({
      id: c.id,
      title: c.title,
      position: c.position,
      folder: `${pad(ci + 1)} - ${safeName(c.title)}`,
      scenes: (scenes ?? [])
        .filter((s) => s.chapter_id === c.id)
        .map((s, si) => ({
          id: s.id,
          title: s.title,
          position: s.position,
          word_count: s.word_count,
          updated_at: s.updated_at,
          file: `${pad(si + 1)} - ${safeName(s.title)}.md`,
        })),
    })),
  };
  root.file("manifest.json", JSON.stringify(manifest, null, 2));

  for (const [ci, chapter] of (chapters ?? []).entries() as IterableIterator<
    [number, { id: string; title: string }]
  >) {
    const chapterFolder = root.folder(`${pad(ci + 1)} - ${safeName(chapter.title)}`);
    if (!chapterFolder) continue;
    const chapterScenes = (scenes ?? []).filter((s) => s.chapter_id === chapter.id);
    for (const [si, scene] of chapterScenes.entries()) {
      const md = `# ${scene.title}\n\n${tiptapToMarkdown(scene.content)}`;
      chapterFolder.file(`${pad(si + 1)} - ${safeName(scene.title)}.md`, md);
    }
  }

  const buffer = await zip.generateAsync({ type: "uint8array" });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `${safeName(project.title)}-${stamp}.zip`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
