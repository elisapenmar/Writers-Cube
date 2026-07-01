"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { importTextAsProject, importHtmlAsProject } from "@/server/import";
import {
  type Manuscript,
  tiptapToParagraphs,
  renderDocx,
  safeName,
} from "@/lib/manuscript-export";
import { getPublishSettings } from "@/server/publish";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DriveStatus = { connected: boolean; email: string | null };
export type DriveDoc = { id: string; name: string; modifiedTime: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

type Creds = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  email: string | null;
};

async function loadCreds(): Promise<{ userId: string; creds: Creds | null }> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("google_credentials")
    .select("access_token, refresh_token, expires_at, email")
    .eq("user_id", user.id)
    .maybeSingle();
  return { userId: user.id, creds: (data as Creds) ?? null };
}

/** Refresh the Google access token if expired and we have the means to. */
async function freshToken(): Promise<{ token: string; email: string | null } | null> {
  const { userId, creds } = await loadCreds();
  if (!creds?.access_token) return null;

  const expired =
    creds.expires_at != null && Date.now() > new Date(creds.expires_at).getTime() - 60_000;

  if (expired && creds.refresh_token && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: creds.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { access_token: string; expires_in?: number };
        const expiresAt = new Date(Date.now() + (json.expires_in ?? 3500) * 1000).toISOString();
        const { supabase } = await requireUser();
        await supabase
          .from("google_credentials")
          .update({ access_token: json.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        return { token: json.access_token, email: creds.email };
      }
    } catch {
      /* fall through to the stored token */
    }
  }
  return { token: creds.access_token, email: creds.email };
}

class ReconnectError extends Error {
  constructor() {
    super("Your Google Drive session expired. Please reconnect.");
  }
}

/** Pull a short, human-readable reason out of a Google API error body. */
function summarizeDriveError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; status?: string; errors?: { reason?: string }[] };
    };
    const msg = json.error?.message;
    const reason = json.error?.errors?.[0]?.reason ?? json.error?.status;
    if (msg) return reason ? `${msg} (${reason})` : msg;
  } catch {
    /* not JSON */
  }
  return `Google Drive returned HTTP ${status}.`;
}

async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const t = await freshToken();
  if (!t) throw new ReconnectError();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${t.token}` },
  });
  // 401 = token genuinely invalid/expired → reconnect. Everything else (esp 403:
  // Drive API disabled or scopes not granted) should surface its real reason.
  if (res.status === 401) throw new ReconnectError();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(summarizeDriveError(res.status, body));
  }
  return res;
}

export async function getDriveStatus(): Promise<DriveStatus> {
  const { creds } = await loadCreds();
  return { connected: !!creds?.access_token, email: creds?.email ?? null };
}

export async function disconnectDrive(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("google_credentials").delete().eq("user_id", user.id);
}

/** Non-whitespace chars in *body* lines (ignoring heading-only "# " lines). */
function bodyDense(t: string): number {
  return t
    .split("\n")
    .filter((l) => l.trim() && !/^#{1,6}\s/.test(l.trim()))
    .join("")
    .replace(/\s+/g, "").length;
}

function emptyImportError(title: string, fetched: string): Error {
  const snippet = fetched.replace(/\s+/g, " ").trim().slice(0, 180);
  return new Error(
    `“${title}” imported with no body text. Google returned only: “${snippet || "(nothing)"}”. ` +
      `If the doc has content, it may be in a Google Docs tab, a table, or a text box that doesn't export — ` +
      `try File → Download → .docx in Google Docs, then import that file from your computer.`,
  );
}

/** Plain-text export → markdown-ish: one line per paragraph, chapter-ish lines
 *  promoted to "## " so the parser splits chapters. */
function plainToMarkdownish(plain: string): string {
  const lines = plain.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  return lines
    .map((l) => {
      if (!l) return "";
      if (l.length < 60 && /^(chapter\b.*|prologue|epilogue|part\b.*)$/i.test(l)) {
        return `## ${l}`;
      }
      return l;
    })
    .join("\n\n");
}

/** Import a Google Doc's contents as a new project. Returns the project id. */
export async function importDriveDoc(fileId: string): Promise<{ projectId: string }> {
  // Fetch the doc name for the title.
  const metaRes = await driveFetch(`${DRIVE_API}/files/${fileId}?fields=name`);
  const meta = (await metaRes.json()) as { name?: string };
  const title = meta.name ?? "Imported document";

  const exportUrl = (mime: string) =>
    `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`;
  const tryGet = async (fn: () => Promise<string>): Promise<string> => {
    try {
      return await fn();
    } catch {
      return "";
    }
  };
  const visibleLen = (html: string) =>
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

  // Get the doc as semantic HTML two ways — DOCX→mammoth (cleanest lists) and
  // Google's HTML export — and import whichever has more content, PRESERVING
  // formatting. Google's exports are inconsistent, so we don't trust just one.
  const [docxHtml, googleHtml] = await Promise.all([
    tryGet(async () => {
      const buf = Buffer.from(await (await driveFetch(exportUrl(DOCX_MIME))).arrayBuffer());
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.convertToHtml({ buffer: buf });
      return value;
    }),
    tryGet(async () => (await driveFetch(exportUrl("text/html"))).text()),
  ]);

  const html = visibleLen(docxHtml) >= visibleLen(googleHtml) ? docxHtml : googleHtml;
  if (visibleLen(html) >= 2) {
    const { projectId } = await importHtmlAsProject(html, title);
    return { projectId };
  }

  // Last resort: plain-text export.
  const plain = await tryGet(async () =>
    plainToMarkdownish(await (await driveFetch(exportUrl("text/plain"))).text()),
  );
  if (bodyDense(plain) >= 2) {
    const { projectId } = await importTextAsProject(plain, title);
    return { projectId };
  }
  throw emptyImportError(title, html || plain);
}

// ---- File browser ----

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  importable: boolean;
  modifiedTime: string | null;
};

function isImportable(mime: string): boolean {
  return (
    mime === GOOGLE_DOC ||
    mime === DOCX_MIME ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "application/rtf" ||
    mime === "text/rtf"
  );
}

/** List the children of a Drive folder (defaults to My Drive root). */
export async function browseDrive(folderId?: string): Promise<DriveEntry[]> {
  const parent = folderId || "root";
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)");
  const res = await driveFetch(
    `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=200`,
  );
  if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
  const json = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; modifiedTime?: string }[];
  };
  return (json.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isFolder: f.mimeType === FOLDER_MIME,
    importable: isImportable(f.mimeType),
    modifiedTime: f.modifiedTime ?? null,
  }));
}

/** Import any supported Drive file (Google Doc, Word, text) as a new project. */
export async function importDriveFile(
  fileId: string,
  mimeType: string,
): Promise<{ projectId: string }> {
  if (mimeType === GOOGLE_DOC) return importDriveDoc(fileId);

  const metaRes = await driveFetch(`${DRIVE_API}/files/${fileId}?fields=name`);
  const meta = (await metaRes.json()) as { name?: string };
  const title = (meta.name ?? "Imported document").replace(/\.(docx|txt|md|markdown|rtf)$/i, "");

  // Non-Google files are downloaded directly.
  const dl = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`);

  if (mimeType === DOCX_MIME) {
    // Rich path: preserve lists/headings/marks from the Word doc.
    const buf = Buffer.from(await dl.arrayBuffer());
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    if (value.replace(/<[^>]+>/g, " ").trim().length < 2) {
      throw emptyImportError(title, value);
    }
    const { projectId } = await importHtmlAsProject(value, title);
    return { projectId };
  }

  const text = await dl.text();
  if (bodyDense(text) < 2) {
    throw emptyImportError(title, text);
  }
  const { projectId } = await importTextAsProject(text, title);
  return { projectId };
}

/** Export a project to the user's Google Drive as a Google Doc. */
export async function exportProjectToDrive(projectId: string): Promise<{ name: string }> {
  const { supabase, user } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, author_name, agent_name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) throw new Error("Project not found");

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
          return { title: s.title, paragraphs: tiptapToParagraphs(s.content), doc: s.content };
        }),
    })),
  };
  manuscript.totalWords = totalWords;

  const settings = await getPublishSettings(project.id);
  const docx = await renderDocx(manuscript, settings);
  const name = safeName(settings.title || project.title);

  // Multipart upload: docx media + metadata; mimeType GOOGLE_DOC converts it.
  const boundary = `wcube${Date.now()}`;
  const metadata = JSON.stringify({ name, mimeType: GOOGLE_DOC });
  const pre =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre, "utf-8"), docx, Buffer.from(post, "utf-8")]);

  const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Upload to Drive failed (${res.status})`);
  return { name };
}

const BACKUP_FOLDER = "Writer's Cube Backups";

async function findOrCreateBackupFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${BACKUP_FOLDER}' and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  const found = await driveFetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`);
  const json = (await found.json()) as { files?: { id: string }[] };
  if (json.files?.[0]) return json.files[0].id;
  const created = await driveFetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: BACKUP_FOLDER, mimeType: FOLDER_MIME }),
  });
  const c = (await created.json()) as { id: string };
  return c.id;
}

/** Upload a full-account JSON backup into the user's "Writer's Cube Backups" folder. */
export async function uploadBackupToDrive(
  filename: string,
  json: string,
): Promise<{ fileId: string }> {
  const folderId = await findOrCreateBackupFolder();
  const boundary = `wcbk${Date.now()}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: "application/json",
  });
  const pre =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(pre, "utf-8"),
    Buffer.from(json, "utf-8"),
    Buffer.from(post, "utf-8"),
  ]);
  const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Backup upload failed (${res.status})`);
  const out = (await res.json()) as { id: string };
  return { fileId: out.id };
}
