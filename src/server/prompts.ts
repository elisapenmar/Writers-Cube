"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  promptsForFilters,
  type PromptFocus,
  type PromptFormat,
  type PromptDepth,
} from "@/lib/prompt-library";
import {
  renderPrompt,
  segmentsToPlainText,
  type EntityBag,
  type RenderedPrompt,
} from "@/lib/prompt-fill";

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
    m.includes("prompt_exercises") &&
    (m.includes("relation") || m.includes("does not exist") || m.includes("schema cache"))
  );
}
const MIGRATION_REMINDER =
  "The 'prompt_exercises' table is missing. Run supabase/migrations/0011_prompt_exercises.sql in the SQL editor.";

const EMPTY_BAG: EntityBag = { characters: [], places: [], threads: [], objects: [] };

/** Pull entities from a project's manuscript + notes + characters table. */
export async function extractEntities(projectId: string): Promise<EntityBag> {
  const { supabase, user } = await requireUser();

  // Characters table (already maintained by the Organize > Characters tab).
  const { data: chars } = await supabase
    .from("characters")
    .select("name")
    .eq("user_id", user.id);
  const knownCharacters = (chars ?? [])
    .map((c) => (c.name as string)?.trim())
    .filter(Boolean) as string[];

  // Project notes.
  const { data: project } = await supabase
    .from("projects")
    .select("notes")
    .eq("id", projectId)
    .maybeSingle();
  const notes = ((project?.notes as string | undefined) ?? "").trim();

  // A slice of the manuscript text.
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", projectId);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  let manuscript = "";
  if (chapterIds.length > 0) {
    const { data: scenes } = await supabase
      .from("scenes")
      .select("content")
      .in("chapter_id", chapterIds)
      .limit(40);
    for (const s of scenes ?? []) {
      manuscript += " " + plainTextFromDoc(s.content);
      if (manuscript.length > 6000) break;
    }
  }
  manuscript = manuscript.slice(0, 6000).trim();

  if (!manuscript && !notes && knownCharacters.length === 0) {
    return EMPTY_BAG;
  }

  // Ask Claude to extract entities; seed it with the known character names.
  try {
    const anthropic = getAnthropic();
    const completion = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: `Extract reusable story entities from a writer's manuscript and notes, for use in writing prompts. Only include things actually present in the material — never invent. Prefer specific, named entities.

- characters: named people (include any provided known names that appear)
- places: specific settings/locations
- threads: unresolved tensions, open questions, or dangling plot threads, each phrased as a short noun phrase
- objects: recurring or charged physical objects

Call extract_entities. No prose.`,
      tools: [
        {
          name: "extract_entities",
          description: "Return story entities extracted from the material.",
          input_schema: {
            type: "object",
            properties: {
              characters: { type: "array", items: { type: "string" } },
              places: { type: "array", items: { type: "string" } },
              threads: { type: "array", items: { type: "string" } },
              objects: { type: "array", items: { type: "string" } },
            },
            required: ["characters", "places", "threads", "objects"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_entities" },
      messages: [
        {
          role: "user",
          content: `KNOWN CHARACTER NAMES: ${knownCharacters.join(", ") || "(none)"}\n\nNOTES:\n${notes || "(none)"}\n\nMANUSCRIPT EXCERPT:\n${manuscript || "(none)"}\n\nExtract the entities now.`,
        },
      ],
    });
    const toolUse = completion.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    const raw = (toolUse?.input as Partial<EntityBag> | undefined) ?? {};
    const dedupe = (a: string[] | undefined) =>
      Array.from(new Set((a ?? []).map((s) => s.trim()).filter(Boolean)));
    const bag: EntityBag = {
      characters: dedupe([...(raw.characters ?? []), ...knownCharacters]),
      places: dedupe(raw.places),
      threads: dedupe(raw.threads),
      objects: dedupe(raw.objects),
    };
    return bag;
  } catch {
    // Fall back to just the known character names.
    return { ...EMPTY_BAG, characters: knownCharacters };
  }
}

export type GenerateResult = {
  rendered: RenderedPrompt | null;
  /** entities surfaced for the "here's what we pulled from your draft" panel. */
  entities?: EntityBag;
  message?: string;
};

export async function generatePrompt(opts: {
  focuses: PromptFocus[];
  scenarioSeed: boolean; // true → format = seed
  depth: PromptDepth;
  mode: "new" | "existing";
  projectId?: string | null;
}): Promise<GenerateResult> {
  await requireUser();
  const format: PromptFormat | null = opts.scenarioSeed ? "seed" : "exercise";

  let candidates = promptsForFilters({
    focuses: opts.focuses,
    format,
    depth: opts.depth,
    mode: opts.mode,
  });
  // Relax filters progressively if nothing matched.
  if (candidates.length === 0) {
    candidates = promptsForFilters({
      focuses: opts.focuses,
      format: null,
      depth: "any",
      mode: opts.mode,
    });
  }
  if (candidates.length === 0) {
    candidates = promptsForFilters({
      focuses: [],
      format: null,
      depth: "any",
      mode: opts.mode,
    });
  }
  if (candidates.length === 0) {
    return { rendered: null, message: "No prompts matched. Try fewer filters." };
  }

  const prompt = candidates[Math.floor(Math.random() * candidates.length)];

  let bag: EntityBag = EMPTY_BAG;
  let grounded = false;
  if (opts.mode === "existing" && opts.projectId) {
    bag = await extractEntities(opts.projectId);
    grounded =
      bag.characters.length > 0 ||
      bag.places.length > 0 ||
      bag.threads.length > 0 ||
      bag.objects.length > 0;
  }

  const rendered = renderPrompt(prompt, bag, grounded);
  return { rendered, entities: grounded ? bag : undefined };
}

export type SaveExerciseInput = {
  projectId: string | null;
  rendered: RenderedPrompt;
  promptMode: "new" | "existing";
  writingMode: "free" | "typewriter";
  goalType: "words" | "minutes" | null;
  goalValue: number | null;
  content: unknown;
  wordCount: number;
  title?: string | null;
};

export async function saveExercise(input: SaveExerciseInput): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const promptJson = {
    id: input.rendered.id,
    focus: input.rendered.focus,
    format: input.rendered.format,
    depth: input.rendered.depth,
    source: input.rendered.source,
    grounded: input.rendered.grounded,
    text: segmentsToPlainText(input.rendered.textSegments),
    question: input.rendered.questionSegments
      ? segmentsToPlainText(input.rendered.questionSegments)
      : null,
    constraint: input.rendered.constraint ?? null,
    deeper: segmentsToPlainText(input.rendered.deeperSegments),
  };
  const { data, error } = await supabase
    .from("prompt_exercises")
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      prompt: promptJson,
      focus: input.rendered.focus,
      format: input.rendered.format,
      depth: input.rendered.depth,
      prompt_mode: input.promptMode,
      writing_mode: input.writingMode,
      goal_type: input.goalType,
      goal_value: input.goalValue,
      content: input.content ?? null,
      word_count: input.wordCount,
      title: input.title?.trim() ? input.title.trim().slice(0, 200) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error?.message ?? "save failed");
  }
  revalidatePath("/app/dashboard");
  return { id: data.id as string };
}

export type ExerciseSummary = {
  id: string;
  project_id: string | null;
  focus: string;
  format: string;
  depth: string;
  prompt_mode: string;
  writing_mode: string;
  word_count: number;
  title: string | null;
  prompt: {
    text: string;
    question: string | null;
    constraint: string | null;
    deeper: string;
    source?: string;
  };
  content: unknown;
  created_at: string;
};

export async function listExercises(
  projectId: string | null,
): Promise<ExerciseSummary[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("prompt_exercises")
    .select(
      "id, project_id, focus, format, depth, prompt_mode, writing_mode, word_count, title, prompt, content, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as ExerciseSummary[];
}

export async function getExercise(id: string): Promise<ExerciseSummary | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("prompt_exercises")
    .select(
      "id, project_id, focus, format, depth, prompt_mode, writing_mode, word_count, title, prompt, content, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data as unknown as ExerciseSummary) ?? null;
}

export async function updateExercise(
  id: string,
  patch: { title?: string; content?: unknown; wordCount?: number },
): Promise<void> {
  const { supabase, user } = await requireUser();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === "string") update.title = patch.title.slice(0, 200);
  if (patch.content !== undefined) update.content = patch.content;
  if (typeof patch.wordCount === "number") update.word_count = patch.wordCount;
  const { error } = await supabase
    .from("prompt_exercises")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app/exercises");
}

export async function deleteExercise(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("prompt_exercises")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  revalidatePath("/app/dashboard");
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
