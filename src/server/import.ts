"use server";

import { redirect } from "next/navigation";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { setActiveProject } from "@/server/projects";

type ParsedScene = { paragraphs: string[] };
type ParsedChapter = { title: string; scenes: ParsedScene[] };
type Parsed = { title: string; chapters: ParsedChapter[] };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const SCENE_BREAK = /^(\s*[*#]\s*[*]?\s*[*]?\s*|---+|\*\s*\*\s*\*)\s*$/;

/** Parse markdown-ish text into chapters → scenes → paragraphs. */
function parseMarkdownish(text: string, fallbackTitle: string): Parsed {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let title = fallbackTitle;
  const chapters: ParsedChapter[] = [];
  let chapter: ParsedChapter | null = null;
  let scene: ParsedScene | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const t = para.join(" ").trim();
      if (t) {
        if (!chapter) {
          // Lazily create the holding chapter AND register it — otherwise a
          // document with no explicit heading drops all its content.
          chapter = { title: "Chapter 1", scenes: [] };
          chapters.push(chapter);
        }
        if (!scene) {
          scene = { paragraphs: [] };
          chapter.scenes.push(scene);
        }
        scene.paragraphs.push(t);
      }
      para = [];
    }
  };
  const newScene = () => {
    flushPara();
    scene = null;
  };
  const newChapter = (t: string) => {
    flushPara();
    chapter = { title: t || `Chapter ${chapters.length + 1}`, scenes: [] };
    chapters.push(chapter);
    scene = null;
  };

  let sawH1 = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1 && !sawH1) {
      // First H1 → the manuscript title.
      title = h1[1].trim() || title;
      sawH1 = true;
      continue;
    }
    if (h2 || (h1 && sawH1)) {
      const t = (h2?.[1] ?? h1?.[1] ?? "").replace(/^chapter\s+\d+\s*[—:-]?\s*/i, "").trim();
      newChapter(t);
      continue;
    }
    if (SCENE_BREAK.test(line)) {
      newScene();
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();

  if (chapters.length === 0) {
    chapters.push({ title: "Chapter 1", scenes: [{ paragraphs: [] }] });
  }
  return { title, chapters };
}

function htmlToMarkdownish(html: string): string {
  let s = html;
  // Drop everything that isn't body content (Google Docs export ships a big
  // <head><style>… block that would otherwise leak in as text).
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) s = bodyMatch[1];

  return s
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n## $1\n\n")
    // Paragraphs/divs end a block → blank line so the parser keeps them apart.
    .replace(/<\/(p|div)>/gi, "\n\n")
    .replace(/<\/(li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function docFromParagraphs(paragraphs: string[]) {
  const content = paragraphs.length
    ? paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }))
    : [{ type: "paragraph" }];
  return { type: "doc", content };
}

function wordCount(paragraphs: string[]): number {
  return paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

/** Extract plain text from an uploaded document, for importing into Notes. */
export async function extractDocumentText(formData: FormData): Promise<string> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to import.");
  }
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value.trim();
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    return buf.toString("utf-8").trim();
  }
  throw new Error("Unsupported file. Use .docx, .md, or .txt.");
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/** Persist a parsed manuscript as a new project; returns the project id. */
async function persistParsed(
  supabase: SupabaseLike,
  userId: string,
  parsed: Parsed,
  fallbackTitle: string,
): Promise<string> {
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({ user_id: userId, title: parsed.title || fallbackTitle || "Imported manuscript" })
    .select("id")
    .single();
  if (projErr || !project) throw new Error(projErr?.message ?? "Could not create project");

  for (let ci = 0; ci < parsed.chapters.length; ci++) {
    const ch = parsed.chapters[ci];
    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .insert({ project_id: project.id, title: ch.title || `Chapter ${ci + 1}`, position: ci })
      .select("id")
      .single();
    if (chErr || !chapter) throw new Error(chErr?.message ?? "Could not create chapter");

    const scenes = ch.scenes.length ? ch.scenes : [{ paragraphs: [] }];
    for (let si = 0; si < scenes.length; si++) {
      const sc = scenes[si];
      const { error: scErr } = await supabase.from("scenes").insert({
        chapter_id: chapter.id,
        title: scenes.length > 1 ? `Scene ${si + 1}` : "Scene 1",
        position: si,
        content: docFromParagraphs(sc.paragraphs),
        word_count: wordCount(sc.paragraphs),
      });
      if (scErr) throw new Error(scErr.message);
    }
  }
  return project.id as string;
}

/** Convert exported HTML (e.g. from Google Docs) to markdown-ish plain text. */
export async function htmlToText(html: string): Promise<string> {
  return htmlToMarkdownish(html);
}

/** Import markdown-ish text as a new project. Returns the id + word count. */
export async function importTextAsProject(
  text: string,
  title: string,
): Promise<{ projectId: string; words: number }> {
  const { supabase, user } = await requireUser();
  const parsed = parseMarkdownish(text, title);
  const words = parsed.chapters.reduce(
    (n, ch) => n + ch.scenes.reduce((m, sc) => m + wordCount(sc.paragraphs), 0),
    0,
  );
  // Never leave a blank project behind — fail loudly instead.
  if (words === 0) {
    throw new Error(
      `“${title}” imported with no readable text. Open it and confirm it has content, then try again.`,
    );
  }
  const projectId = await persistParsed(supabase, user.id, parsed, title);
  await setActiveProject(projectId);
  return { projectId, words };
}

export async function importManuscript(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to import.");
  }
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let text: string;
  if (name.endsWith(".docx")) {
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    text = htmlToMarkdownish(value);
  } else if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    text = buf.toString("utf-8");
  } else {
    throw new Error("Unsupported file. Use .docx, .md, or .txt.");
  }

  const baseTitle = file.name.replace(/\.(docx|md|markdown|txt)$/i, "");
  const parsed = parseMarkdownish(text, baseTitle);
  const projectId = await persistParsed(supabase, user.id, parsed, baseTitle);

  await setActiveProject(projectId);
  redirect("/app/manuscript");
}
