"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { htmlToPlainText } from "@/lib/html-text";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** One saved research source, keyed by project. */
export type Source = {
  id: string;
  url: string;
  title: string;
  author: string;
  publication: string;
  published_date: string;
  quote: string;
  note: string;
  kind: string;
  created_at: string;
};

/** A new source's editable fields (everything except id/created_at). */
export type SourceInput = {
  url?: string;
  title?: string;
  author?: string;
  publication?: string;
  published_date?: string;
  quote?: string;
  note?: string;
  kind?: string;
};

/**
 * A candidate the AI gather step proposes. `verified` is true only when the URL
 * came back from Claude's server-side web search (a real, openable result); when
 * the model proposed it from memory we keep `verified` false so the UI tells the
 * writer to open and check the link before accepting.
 */
export type SourceSuggestion = {
  url: string;
  title: string;
  author: string;
  publication: string;
  published_date: string;
  kind: string;
  reason: string;
  verified: boolean;
};

const SOURCE_COLUMNS =
  "id, url, title, author, publication, published_date, quote, note, kind, created_at";

function cleanField(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function listSources(): Promise<Source[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("sources")
    .select(SOURCE_COLUMNS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

export async function addSource(input: SourceInput): Promise<Source> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");

  const row = {
    user_id: user.id,
    project_id: projectId,
    url: cleanField(input.url, 2000),
    title: cleanField(input.title, 500),
    author: cleanField(input.author, 300),
    publication: cleanField(input.publication, 300),
    published_date: cleanField(input.published_date, 100),
    quote: cleanField(input.quote, 2000),
    note: cleanField(input.note, 2000),
    kind: cleanField(input.kind, 60) || "website",
  };
  const { data, error } = await supabase
    .from("sources")
    .insert(row)
    .select(SOURCE_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save source");
  revalidatePath("/app", "layout");
  return data as Source;
}

export async function updateSource(id: string, patch: SourceInput): Promise<void> {
  const { supabase, user } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.url !== undefined) update.url = cleanField(patch.url, 2000);
  if (patch.title !== undefined) update.title = cleanField(patch.title, 500);
  if (patch.author !== undefined) update.author = cleanField(patch.author, 300);
  if (patch.publication !== undefined) update.publication = cleanField(patch.publication, 300);
  if (patch.published_date !== undefined) update.published_date = cleanField(patch.published_date, 100);
  if (patch.quote !== undefined) update.quote = cleanField(patch.quote, 2000);
  if (patch.note !== undefined) update.note = cleanField(patch.note, 2000);
  if (patch.kind !== undefined) update.kind = cleanField(patch.kind, 60) || "website";
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("sources")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

export async function deleteSource(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/** Pull the project's topic/title + notes to ground the source search. */
async function gatherTopic(projectId: string): Promise<{ title: string; context: string }> {
  const { supabase } = await requireUser();
  const { data: project } = await supabase
    .from("projects")
    .select("title, notes")
    .eq("id", projectId)
    .maybeSingle();
  const title = (project?.title as string | undefined)?.trim() || "Untitled essay";
  const notes = htmlToPlainText((project?.notes as string | undefined) ?? "").trim();

  let manuscript = "";
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", projectId);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  if (chapterIds.length > 0) {
    const { data: scenes } = await supabase
      .from("scenes")
      .select("content")
      .in("chapter_id", chapterIds)
      .limit(20);
    for (const s of scenes ?? []) {
      let text = "";
      const walk = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        const node = n as { type?: string; text?: string; content?: unknown[] };
        if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
        if (Array.isArray(node.content)) node.content.forEach(walk);
      };
      walk(s.content);
      manuscript += " " + text.replace(/\s+/g, " ").trim();
      if (manuscript.length > 6000) break;
    }
  }
  const context = `${notes}\n\n${manuscript}`.slice(0, 8000).trim();
  return { title, context };
}

/**
 * AI source gathering. We enable Claude's server-side web search tool so the
 * links the writer sees come back from a real search, not the model's memory.
 *
 * Grounding contract: every suggestion carries a `verified` flag. A suggestion is
 * `verified: true` only when its URL appeared in a `web_search_result` block from
 * the search tool (a real, openable result). If the search tool is unavailable
 * for the configured key, or the model names a source it did not actually find,
 * the suggestion comes back `verified: false` and the panel makes the writer open
 * and confirm the link before they can accept it. We never present a fabricated
 * link as verified.
 *
 * `selection` is optional focused text (e.g. the writer highlighted a claim to
 * find support for); otherwise we ground on the project's topic + notes.
 */
export async function gatherSources(selection?: string): Promise<{
  suggestions: SourceSuggestion[];
  searched: boolean;
}> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");

  const { title, context } = await gatherTopic(projectId);
  const focus = (selection ?? "").trim().slice(0, 2000);
  if (!focus && !context && title === "Untitled essay") {
    throw new Error(
      "Add a topic, some notes, or select a claim first, so the search has something to look for.",
    );
  }

  const anthropic = getAnthropic();

  const prompt = `You are a research assistant helping an essayist find credible, citable sources.

ESSAY TITLE: ${title}
${focus ? `\nFOCUS (a claim or passage the writer wants support for):\n${focus}` : ""}
${context ? `\nWORKING NOTES / DRAFT EXCERPT:\n${context}` : ""}

Use the web_search tool to find 4 to 6 credible, relevant sources (reputable news, academic, government, or established reference sites). Prefer primary sources and well-known publications. For each source, after searching, briefly say in one sentence why it is relevant. Do not invent URLs; only point to pages you actually found via search.`;

  // TODO(grounding): if a future key loses web-search entitlement, the request
  // below throws; we catch that and fall back to an un-searched suggestion pass
  // whose results are all marked verified:false so the writer must open each link.
  let message: Anthropic.Message;
  let searched = true;
  try {
    message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      messages: [{ role: "user", content: prompt }],
    });
  } catch {
    searched = false;
    message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n(Web search is unavailable. Suggest sources you believe exist, but the writer will verify each link themselves.)`,
        },
      ],
    });
  }

  // Collect the REAL results that came back from the search tool. These are the
  // only URLs we are willing to mark verified.
  const verifiedByUrl = new Map<
    string,
    { url: string; title: string; page_age: string | null }
  >();
  for (const block of message.content) {
    if (block.type === "web_search_tool_result") {
      const content = block.content;
      if (Array.isArray(content)) {
        for (const r of content) {
          if (r.type === "web_search_result" && r.url) {
            verifiedByUrl.set(r.url, {
              url: r.url,
              title: r.title ?? "",
              page_age: r.page_age ?? null,
            });
          }
        }
      }
    }
  }

  // The model's prose ties results to the essay. We hand back the verified
  // results as accept-ready suggestions, plus any model-named extras (unverified).
  const reasonByUrl = extractReasons(message);

  const suggestions: SourceSuggestion[] = [];
  for (const v of verifiedByUrl.values()) {
    suggestions.push({
      url: v.url,
      title: v.title,
      author: "",
      publication: hostOf(v.url),
      published_date: v.page_age ?? "",
      kind: "website",
      reason: reasonByUrl.get(v.url) ?? "",
      verified: true,
    });
  }

  // If the search yielded nothing real (e.g. fallback path), surface any URLs the
  // model wrote in prose as unverified candidates the writer must open and check.
  if (suggestions.length === 0) {
    for (const [url, reason] of extractUrlsFromText(message)) {
      suggestions.push({
        url,
        title: "",
        author: "",
        publication: hostOf(url),
        published_date: "",
        kind: "website",
        reason,
        verified: false,
      });
    }
  }

  if (suggestions.length === 0) {
    throw new Error(
      "No sources came back. Try adding a clearer topic or selecting the specific claim you want to support.",
    );
  }
  return { suggestions, searched };
}

/** Map result URLs to the model's one-line relevance note when it cites them. */
function extractReasons(message: Anthropic.Message): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of message.content) {
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c.type === "web_search_result_location" && c.url) {
          const existing = map.get(c.url);
          const snippet = (c.cited_text ?? "").trim().slice(0, 200);
          if (snippet && !existing) map.set(c.url, snippet);
        }
      }
    }
  }
  return map;
}

/** Last-resort: pull bare URLs (and surrounding sentence) from the model's prose. */
function extractUrlsFromText(message: Anthropic.Message): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  const urlRe = /https?:\/\/[^\s)<>"']+/g;
  for (const block of message.content) {
    if (block.type !== "text") continue;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(block.text)) !== null) {
      const url = m[0].replace(/[.,;]+$/, "");
      if (seen.has(url)) continue;
      seen.add(url);
      out.push([url, ""]);
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
