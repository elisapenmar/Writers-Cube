"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";

export type Character = {
  id: string;
  name: string;
  role: string | null;
  description: string;
  position: number;
  updated_at: string;
};

export type CharacterMatrix = {
  chapters: { id: string; title: string }[];
  rows: {
    id: string;
    name: string;
    counts: number[]; // mentions per chapter (aligned with `chapters`)
    sceneByChapter: (string | null)[]; // first scene per chapter that mentions them
    total: number;
  }[];
};

function countName(hay: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const m = hay.match(re);
  return m ? m.length : 0;
}

/**
 * Build the character × chapter occurrence grid for the active project: counts
 * each character's name mentions per chapter (from scene prose) and the first
 * scene in each chapter where they appear (for linking into the manuscript).
 */
export async function characterChapterMatrix(): Promise<CharacterMatrix> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return { chapters: [], rows: [] };

  const { data: chars } = await supabase
    .from("characters")
    .select("id, name, position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const characters = (chars ?? []).filter((c) => String(c.name ?? "").trim());

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

  // Per-chapter concatenated prose + the ordered scenes (for first-mention links).
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

  const rows = characters.map((c) => {
    const name = String(c.name).trim();
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
    return { id: c.id as string, name, counts, sceneByChapter, total };
  });

  return {
    chapters: chapterList.map((c) => ({
      id: c.id as string,
      title: String(c.title ?? ""),
    })),
    rows,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function isMissingTable(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("characters") && (m.includes("relation") || m.includes("does not exist"))
  );
}
const MIGRATION_REMINDER =
  "The 'characters' table is missing in Supabase. Run the SQL in supabase/migrations/0006_characters_table.sql.";

export async function listCharacters(): Promise<Character[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return [];
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, role, description, position, updated_at")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data ?? []) as Character[];
}

export async function createCharacter(initial?: {
  name?: string;
  role?: string;
  description?: string;
}): Promise<Character> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const { data: last } = await supabase
    .from("characters")
    .select("position")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      project_id: projectId,
      name: initial?.name?.trim() || "New character",
      role: initial?.role?.trim() || null,
      description: initial?.description?.trim() || "",
      position,
    })
    .select("id, name, role, description, position, updated_at")
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error?.message ?? "create failed");
  }
  revalidatePath("/app");
  return data as Character;
}

export async function updateCharacter(
  id: string,
  patch: { name?: string; role?: string | null; description?: string },
): Promise<void> {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.name === "string") {
    update.name = patch.name.trim().slice(0, 200) || "Unnamed";
  }
  if (patch.role !== undefined) {
    update.role = patch.role ? patch.role.trim().slice(0, 120) : null;
  }
  if (typeof patch.description === "string") {
    update.description = patch.description;
  }
  const { error } = await supabase
    .from("characters")
    .update(update)
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
}

export async function deleteCharacter(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("characters").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app");
}

/**
 * Use Claude to extract a character list from the brainstorm conversation
 * and the working notes. Merges into the existing character table:
 *   - Names matching an existing character (case-insensitive) → only fill
 *     blank description fields. Never overwrite the writer's manual edits.
 *   - New names → insert.
 */
export async function pullCharactersFromBrainstorm(): Promise<{
  added: number;
  filled: number;
  total: number;
}> {
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
    throw new Error(
      "No brainstorm content yet. Talk to the thought partner first.",
    );
  }
  const transcript = messages
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n");

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: `You're extracting a character list from a novelist's brainstorm.

Rules:
- Only include people the writer has actually mentioned. Don't invent characters.
- Each character entry should have:
  - name: the most specific name the writer used (full name if given)
  - role: a brief role descriptor in the writer's terms (e.g. "protagonist", "modern-day woman", "1870s archaeologist", "best friend") — keep it short. If unclear, omit.
  - description: 3–6 short bullet points (NOT prose), one fact/trait/relationship/arc-beat per line, each line starting with "• ". Use the writer's own words wherever possible. Don't editorialize.
- Skip any character with less than a sentence of substance.
- Don't include the thought partner or the writer herself.

Call the list_characters tool. Do not write any text in your response.`,
    tools: [
      {
        name: "list_characters",
        description: "Extract a character list from the brainstorm.",
        input_schema: {
          type: "object",
          properties: {
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name", "description"],
              },
            },
          },
          required: ["characters"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "list_characters" },
    messages: [
      {
        role: "user",
        content: `WORKING NOTES:\n\n${notes || "(none yet)"}\n\n---\n\nCONVERSATION:\n\n${transcript || "(none yet)"}\n\n---\n\nExtract the character list now.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  type Extracted = { name: string; role?: string; description: string };
  const extracted =
    (toolUse?.input as { characters?: Extracted[] } | undefined)?.characters ??
    [];

  // Fetch existing characters once
  const { data: existing } = await supabase
    .from("characters")
    .select("id, name, role, description, position")
    .eq("user_id", user.id)
    .eq("project_id", projectId);
  const byNameLower = new Map<string, {
    id: string;
    name: string;
    role: string | null;
    description: string;
    position: number;
  }>();
  for (const c of existing ?? []) {
    byNameLower.set(c.name.toLowerCase().trim(), c as never);
  }

  let positionCursor =
    (existing ?? []).reduce((max, c) => Math.max(max, c.position), -1) + 1;
  let added = 0;
  let filled = 0;

  for (const x of extracted) {
    const key = x.name.toLowerCase().trim();
    const match = byNameLower.get(key);
    if (match) {
      // Only fill if description is empty — never overwrite manual edits
      if (!match.description.trim() && x.description.trim()) {
        const { error: updErr } = await supabase
          .from("characters")
          .update({
            description: x.description.trim(),
            role: match.role ?? x.role?.trim() ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.id);
        if (updErr) {
          if (isMissingTable(updErr)) throw new Error(MIGRATION_REMINDER);
          throw new Error(updErr.message);
        }
        filled += 1;
      }
    } else {
      const { error: insErr } = await supabase.from("characters").insert({
        user_id: user.id,
        project_id: projectId,
        name: x.name.trim() || "Unnamed",
        role: x.role?.trim() || null,
        description: x.description.trim(),
        position: positionCursor,
      });
      if (insErr) {
        if (isMissingTable(insErr)) throw new Error(MIGRATION_REMINDER);
        throw new Error(insErr.message);
      }
      positionCursor += 1;
      added += 1;
    }
  }

  revalidatePath("/app");
  const total = (existing?.length ?? 0) + added;
  return { added, filled, total };
}

type ExtractedChar = { name: string; role?: string; description: string };

/** Non-destructive merge: new names inserted; existing names only get blank
 *  descriptions filled. Never overwrites the writer's manual edits. */
async function mergeExtracted(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  projectId: string,
  extracted: ExtractedChar[],
): Promise<{ added: number; filled: number; total: number }> {
  const { data: existing } = await supabase
    .from("characters")
    .select("id, name, role, description, position")
    .eq("user_id", userId)
    .eq("project_id", projectId);
  const byNameLower = new Map<
    string,
    { id: string; name: string; role: string | null; description: string; position: number }
  >();
  for (const c of existing ?? []) byNameLower.set(c.name.toLowerCase().trim(), c as never);

  let positionCursor =
    (existing ?? []).reduce((max, c) => Math.max(max, c.position), -1) + 1;
  let added = 0;
  let filled = 0;

  for (const x of extracted) {
    if (!x?.name) continue;
    const key = x.name.toLowerCase().trim();
    const match = byNameLower.get(key);
    if (match) {
      if (!match.description.trim() && x.description?.trim()) {
        const { error } = await supabase
          .from("characters")
          .update({
            description: x.description.trim(),
            role: match.role ?? x.role?.trim() ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.id);
        if (error) {
          if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
          throw new Error(error.message);
        }
        filled += 1;
      }
    } else {
      const { error } = await supabase.from("characters").insert({
        user_id: userId,
        project_id: projectId,
        name: x.name.trim() || "Unnamed",
        role: x.role?.trim() || null,
        description: x.description?.trim() || "",
        position: positionCursor,
      });
      if (error) {
        if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
        throw new Error(error.message);
      }
      positionCursor += 1;
      added += 1;
    }
  }
  revalidatePath("/app");
  return { added, filled, total: (existing?.length ?? 0) + added };
}

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

/**
 * Extract characters from the project's actual manuscript (scene prose) + notes
 * and merge non-destructively into the character list.
 */
export async function pullCharactersFromProject(): Promise<{
  added: number;
  filled: number;
  total: number;
}> {
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

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: `You're extracting a character list from a novelist's actual manuscript prose (and notes).

Rules:
- Only include people who actually appear in the text. Don't invent characters.
- name: the most specific name used in the text.
- role: a short descriptor inferred from the text (e.g. "protagonist", "her brother"). Omit if unclear.
- description: 3–6 short bullet points (NOT prose), one fact/trait/relationship/arc-beat per line, each starting with "• ". Ground every bullet in what the text actually shows. Use the writer's own details.
- Skip walk-on names with no substance.

Call list_characters. No prose.`,
    tools: [
      {
        name: "list_characters",
        description: "Extract a character list from the manuscript.",
        input_schema: {
          type: "object",
          properties: {
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name", "description"],
              },
            },
          },
          required: ["characters"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "list_characters" },
    messages: [
      {
        role: "user",
        content: `NOTES:\n\n${notes || "(none)"}\n\n---\n\nMANUSCRIPT:\n\n${manuscript || "(none)"}\n\n---\n\nExtract the character list now.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const extracted =
    (toolUse?.input as { characters?: ExtractedChar[] } | undefined)?.characters ?? [];
  return mergeExtracted(supabase, user.id, projectId, extracted);
}
