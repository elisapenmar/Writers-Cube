// Shared CRUD for the simple Story Bible element tables (places, items). These
// mirror the core of characters but without the AI pull/cite/grid extras.
// Not a "use server" module itself — the thin per-table wrappers (places.ts,
// items.ts) expose these as server actions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";

export type StoryItem = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  position: number;
  updated_at: string;
};

/** Same shape as the character grid: element × chapter name-mention counts. */
export type ElementMatrix = {
  chapters: { id: string; title: string }[];
  rows: {
    id: string;
    name: string;
    counts: number[]; // mentions per chapter (aligned with `chapters`)
    sceneByChapter: (string | null)[]; // first scene per chapter that mentions it
    total: number;
  }[];
};

const COLS = "id, name, category, description, position, updated_at";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function missingTableError(table: string): string {
  return `The '${table}' table is missing in Supabase. Run the matching SQL in supabase/migrations/.`;
}

function isMissingTable(table: string, err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes(table) && (m.includes("relation") || m.includes("does not exist"));
}

export async function listElements(table: string): Promise<StoryItem[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from(table)
    .select(COLS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
  return (data ?? []) as StoryItem[];
}

export async function createElement(
  table: string,
  defaultName: string,
): Promise<StoryItem> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const { data: last } = await supabase
    .from(table)
    .select("position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from(table)
    .insert({
      user_id: user.id,
      project_id: projectId,
      name: defaultName,
      description: "",
      position,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as StoryItem;
}

export async function updateElement(
  table: string,
  id: string,
  patch: { name?: string; category?: string | null; description?: string },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.name === "string") {
    update.name = patch.name.trim().slice(0, 200) || "Unnamed";
  }
  if (patch.category !== undefined) {
    update.category = patch.category ? patch.category.trim().slice(0, 120) : null;
  }
  if (typeof patch.description === "string") {
    update.description = patch.description;
  }
  const { error } = await supabase.from(table).update(update).eq("id", id);
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
}

export async function deleteElement(table: string, id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    if (isMissingTable(table, error)) throw new Error(missingTableError(table));
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

// ---- Appearance grid (element × chapter) ----------------------------------

function plainTextFromDoc(doc: unknown): string {
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.replace(/\s+/g, " ").trim();
}

function countName(hay: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const m = hay.match(re);
  return m ? m.length : 0;
}

/**
 * Build the element × chapter occurrence grid for the active project: counts
 * each element's name mentions per chapter (from scene prose) and the first
 * scene in each chapter where it appears (for linking into the manuscript).
 * Generic over the element table (places, items) — mirrors characterChapterMatrix.
 */
export async function elementChapterMatrix(table: string): Promise<ElementMatrix> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return { chapters: [], rows: [] };

  const { data: els } = await supabase
    .from(table)
    .select("id, name, position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const elements = (els ?? []).filter((e) => String(e.name ?? "").trim());

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const chapterList = chapters ?? [];
  const chapterIds = chapterList.map((c) => c.id as string);

  const { data: scenes } = chapterIds.length
    ? await supabase
        .from("scenes")
        .select("id, chapter_id, position, content")
        .in("chapter_id", chapterIds)
        .order("position", { ascending: true })
    : { data: [] as { id: string; chapter_id: string; content: unknown }[] };

  const textByChapter = new Map<string, string>();
  const scenesByChapter = new Map<string, { id: string; text: string }[]>();
  for (const s of scenes ?? []) {
    const cid = s.chapter_id as string;
    const text = plainTextFromDoc((s as { content?: unknown }).content);
    textByChapter.set(cid, (textByChapter.get(cid) ?? "") + " " + text);
    const arr = scenesByChapter.get(cid) ?? [];
    arr.push({ id: s.id as string, text });
    scenesByChapter.set(cid, arr);
  }

  const rows = elements.map((e) => {
    const name = String(e.name).trim();
    const counts: number[] = [];
    const sceneByChapter: (string | null)[] = [];
    let total = 0;
    for (const ch of chapterList) {
      const cid = ch.id as string;
      const count = countName(textByChapter.get(cid) ?? "", name);
      counts.push(count);
      total += count;
      let scene: string | null = null;
      if (count > 0) {
        for (const s of scenesByChapter.get(cid) ?? []) {
          if (countName(s.text, name) > 0) {
            scene = s.id;
            break;
          }
        }
      }
      sceneByChapter.push(scene);
    }
    return { id: e.id as string, name, counts, sceneByChapter, total };
  });

  return {
    chapters: chapterList.map((c) => ({
      id: c.id as string,
      title: String(c.title ?? ""),
    })),
    rows,
  };
}

// ---- AI pull (brainstorm / manuscript -> elements) ------------------------

type ExtractedElement = { name: string; category?: string; description: string };

/** Per-noun copy for the extraction prompt. */
const ELEMENT_GUIDE: Record<
  string,
  { plural: string; what: string; catHint: string }
> = {
  place: {
    plural: "places",
    what: "places, locations, and settings",
    catHint: "a short type like 'city', 'building', 'region', or 'realm'",
  },
  item: {
    plural: "items",
    what: "objects, artifacts, and props",
    catHint: "a short type like 'weapon', 'document', 'heirloom', or 'tool'",
  },
};

function guideFor(noun: string) {
  return (
    ELEMENT_GUIDE[noun] ?? {
      plural: `${noun}s`,
      what: `${noun}s`,
      catHint: "a short type",
    }
  );
}

function extractionSystem(noun: string, source: "brainstorm" | "manuscript"): string {
  const g = guideFor(noun);
  const from =
    source === "brainstorm"
      ? "a novelist's brainstorm conversation and working notes"
      : "a novelist's actual manuscript prose (and notes)";
  return `You're extracting a list of ${g.what} from ${from}.

Rules:
- Only include ${g.plural} actually mentioned in the text. Don't invent anything.
- name: the most specific name used in the text.
- category: ${g.catHint}. Omit if unclear.
- description: 2 to 4 short sentences describing it, grounded in what the text shows. Use the writer's own details. Never use em dashes; use commas or periods.
- Skip passing mentions with no substance.

Call the list_elements tool. Do not write any prose in your response.`;
}

const LIST_ELEMENTS_TOOL = {
  name: "list_elements",
  description: "Extract a list of story elements.",
  input_schema: {
    type: "object" as const,
    properties: {
      elements: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            category: { type: "string" as const },
            description: { type: "string" as const },
          },
          required: ["name", "description"],
        },
      },
    },
    required: ["elements"],
  },
};

async function runExtraction(
  noun: string,
  source: "brainstorm" | "manuscript",
  userContent: string,
): Promise<ExtractedElement[]> {
  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: extractionSystem(noun, source),
    tools: [LIST_ELEMENTS_TOOL],
    tool_choice: { type: "tool", name: "list_elements" },
    messages: [{ role: "user", content: userContent }],
  });
  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  return (toolUse?.input as { elements?: ExtractedElement[] } | undefined)?.elements ?? [];
}

/** Non-destructive merge: new names inserted; existing names only get blank
 *  descriptions filled. Never overwrites the writer's manual edits. */
async function mergeExtractedElements(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  projectId: string,
  table: string,
  extracted: ExtractedElement[],
): Promise<{ added: number; filled: number; total: number }> {
  const { data: existing } = await supabase
    .from(table)
    .select("id, name, category, description, position")
    .eq("user_id", userId)
    .eq("project_id", projectId);
  const byNameLower = new Map<
    string,
    { id: string; name: string; category: string | null; description: string; position: number }
  >();
  for (const r of existing ?? []) byNameLower.set(r.name.toLowerCase().trim(), r as never);

  let positionCursor =
    (existing ?? []).reduce((max, r) => Math.max(max, r.position), -1) + 1;
  let added = 0;
  let filled = 0;

  for (const x of extracted) {
    if (!x?.name) continue;
    const key = x.name.toLowerCase().trim();
    const match = byNameLower.get(key);
    if (match) {
      if (!match.description?.trim() && x.description?.trim()) {
        const { error } = await supabase
          .from(table)
          .update({
            description: x.description.trim(),
            category: match.category ?? x.category?.trim() ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.id);
        if (error) {
          if (isMissingTable(table, error)) throw new Error(missingTableError(table));
          throw new Error(error.message);
        }
        filled += 1;
      }
    } else {
      const { error } = await supabase.from(table).insert({
        user_id: userId,
        project_id: projectId,
        name: x.name.trim() || "Unnamed",
        category: x.category?.trim() || null,
        description: x.description?.trim() || "",
        position: positionCursor,
      });
      if (error) {
        if (isMissingTable(table, error)) throw new Error(missingTableError(table));
        throw new Error(error.message);
      }
      positionCursor += 1;
      added += 1;
    }
  }
  revalidatePath("/app");
  return { added, filled, total: (existing?.length ?? 0) + added };
}

/** Extract elements from the latest brainstorm conversation + working notes. */
export async function pullElementsFromBrainstorm(
  table: string,
  noun: string,
): Promise<{ added: number; filled: number; total: number }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");

  const { data: bs } = await supabase
    .from("brainstorms")
    .select("messages")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: proj } = await supabase
    .from("projects")
    .select("notes")
    .eq("id", projectId)
    .maybeSingle();

  type Msg = { role: "user" | "assistant"; text: string };
  const messages = (bs?.messages as Msg[] | undefined) ?? [];
  const notes = ((proj?.notes as string | undefined) ?? "").trim();
  if (messages.length === 0 && !notes) {
    throw new Error("No brainstorm content yet. Talk to the thought partner first.");
  }
  const transcript = messages
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n");

  const extracted = await runExtraction(
    noun,
    "brainstorm",
    `WORKING NOTES:\n\n${notes || "(none yet)"}\n\n---\n\nCONVERSATION:\n\n${
      transcript || "(none yet)"
    }\n\n---\n\nExtract the ${guideFor(noun).plural} now.`,
  );
  return mergeExtractedElements(supabase, user.id, projectId, table, extracted);
}

/** Extract elements from the project's actual manuscript (scene prose) + notes. */
export async function pullElementsFromProject(
  table: string,
  noun: string,
): Promise<{ added: number; filled: number; total: number }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");

  const { data: project } = await supabase
    .from("projects")
    .select("id, notes")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("No project found.");
  const notes = ((project.notes as string | undefined) ?? "").trim();

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", project.id);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  let manuscript = "";
  if (chapterIds.length > 0) {
    const { data: scenes } = await supabase
      .from("scenes")
      .select("content")
      .in("chapter_id", chapterIds)
      .limit(60);
    for (const s of scenes ?? []) {
      manuscript += " " + plainTextFromDoc(s.content);
      if (manuscript.length > 12000) break;
    }
  }
  manuscript = manuscript.slice(0, 12000).trim();

  if (!manuscript && !notes) {
    throw new Error("Nothing to read yet — write some scenes first.");
  }

  const extracted = await runExtraction(
    noun,
    "manuscript",
    `NOTES:\n\n${notes || "(none)"}\n\n---\n\nMANUSCRIPT:\n\n${
      manuscript || "(none)"
    }\n\n---\n\nExtract the ${guideFor(noun).plural} now.`,
  );
  return mergeExtractedElements(supabase, user.id, projectId, table, extracted);
}
