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
    .eq("user_id", user.id)
    .eq("project_id", projectId);
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
  mode: "new" | "existing" | "inspiration";
  projectId?: string | null;
}): Promise<GenerateResult> {
  await requireUser();
  const format: PromptFormat | null = opts.scenarioSeed ? "seed" : "exercise";

  // Source: the writer's kernels & inspirations — blend a few of those collected
  // fragments into a fresh prompt (bisociation).
  if (opts.mode === "inspiration") {
    const { supabase, user } = await requireUser();
    const snippets = await collectInspirationSnippets(supabase, user.id);
    if (snippets.length === 0) {
      return {
        rendered: null,
        message:
          "Add a story kernel or some inspiration first — then I can blend them into a prompt.",
      };
    }
    try {
      const template = await authorInspirationPrompt(
        opts.focuses,
        opts.depth,
        format ?? "exercise",
        pickRandom(snippets, 3),
      );
      if (template) {
        return { rendered: renderPrompt(template, EMPTY_BAG, false) };
      }
    } catch {
      /* fall through to the library below */
    }
  }

  // Grounding entities (shared by both the LLM-mix and library paths).
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

  // Grounded "help me with my story": author a prompt that genuinely engages
  // the writer's pulled characters/places/threads, via the LLM + slot pipeline.
  if (opts.mode === "existing" && grounded) {
    try {
      const template = await authorGroundedPrompt(
        opts.focuses,
        format ?? "exercise",
        opts.depth,
        bag,
      );
      if (template) {
        const rendered = renderPrompt(template, bag, true);
        return { rendered, entities: bag };
      }
    } catch {
      // fall through to the library
    }
  }

  // True "mix": scenario seed + one or more craft topics → author a fresh
  // seed-format prompt that genuinely blends the chosen focuses, via the LLM.
  if (opts.scenarioSeed && opts.focuses.length > 0) {
    try {
      const template = await authorSeedMix(opts.focuses, opts.depth);
      if (template) {
        const rendered = renderPrompt(template, bag, grounded);
        return { rendered, entities: grounded ? bag : undefined };
      }
    } catch {
      // fall through to the library
    }
  }

  let candidates = promptsForFilters({
    focuses: opts.focuses,
    format,
    depth: opts.depth,
    mode: opts.mode === "existing" ? "existing" : "new",
  });
  // Relax filters progressively if nothing matched.
  if (candidates.length === 0) {
    candidates = promptsForFilters({
      focuses: opts.focuses,
      format: null,
      depth: "any",
      mode: opts.mode === "existing" ? "existing" : "new",
    });
  }
  if (candidates.length === 0) {
    candidates = promptsForFilters({
      focuses: [],
      format: null,
      depth: "any",
      mode: opts.mode === "existing" ? "existing" : "new",
    });
  }
  if (candidates.length === 0) {
    return { rendered: null, message: "No prompts matched. Try fewer filters." };
  }

  const prompt = candidates[Math.floor(Math.random() * candidates.length)];
  const rendered = renderPrompt(prompt, bag, grounded);
  return { rendered, entities: grounded ? bag : undefined };
}

/**
 * Ask Claude to author a scenario-seed prompt that blends the chosen craft
 * focuses. Returns a PromptObject template (with {{slots}}) so it flows through
 * the same slot-fill + draft-highlight pipeline as the authored library.
 */
import type { PromptObject } from "@/lib/prompt-library";

/**
 * Author a writing prompt grounded in the writer's actual story material.
 * Uses {{slots}} so the entity values are filled (and highlighted) by the
 * existing render pipeline — guaranteeing the prompt is about her draft.
 */
async function authorGroundedPrompt(
  focuses: PromptFocus[],
  format: PromptFormat,
  depth: PromptDepth,
  bag: EntityBag,
): Promise<PromptObject | null> {
  const focusList = focuses.length ? focuses.join(" + ") : "whatever fits the material";
  const entitySummary = [
    bag.characters.length ? `Characters: ${bag.characters.slice(0, 10).join(", ")}` : "",
    bag.places.length ? `Places: ${bag.places.slice(0, 8).join(", ")}` : "",
    bag.threads.length ? `Unresolved threads: ${bag.threads.slice(0, 6).join("; ")}` : "",
    bag.objects.length ? `Objects: ${bag.objects.slice(0, 6).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const formatGuidance =
    format === "seed"
      ? `Write a SCENARIO SEED: a concrete situation (named people, a specific place, mid-moment) plus an open craft question the writer answers by writing the scene. Put the situation in "text" and the question in "question".`
      : `Write a CRAFT EXERCISE: a clear instruction in "text" plus an explicit rule in "constraint".`;

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 700,
    system: `You author a PERSONALIZED writing prompt for a novelist, grounded in HER OWN STORY. You are given the real characters, places, unresolved threads, and objects from her draft. The prompt MUST genuinely engage this specific material — it should be unmistakably about her story, targeting a real gap or tension in it. Never produce a generic prompt.

Craft focus to emphasize: ${focusList}. Depth: ${depth === "deep" ? "a substantial deep dive" : "a ~5-minute warm-up"}.

${formatGuidance}

Reference her material through these placeholder slots so the app fills them with her exact names:
- {{character}} and {{character2}} for people
- {{place}} for a setting
- {{thread}} for an unresolved tension
- {{object}} for a charged object
Use {{character}} and at least one of {{place}}/{{thread}} so the prompt is anchored in her world. Build the sentence naturally around the slots; lean on the actual threads/relationships you're given to make it pointed.

"deeper" = one escalation. "source" = a few-word craft lineage. Call author_prompt; no prose.`,
    tools: [
      {
        name: "author_prompt",
        description: "Return a grounded writing prompt template.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string" },
            question: { type: "string" },
            constraint: { type: "string" },
            deeper: { type: "string" },
            source: { type: "string" },
          },
          required: ["text", "deeper"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "author_prompt" },
    messages: [
      {
        role: "user",
        content: `Here is the material from her draft:\n\n${entitySummary}\n\nAuthor one ${format} prompt grounded in this, emphasizing ${focusList}.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const out = toolUse?.input as
    | { text?: string; question?: string; constraint?: string; deeper?: string; source?: string }
    | undefined;
  if (!out?.text) return null;
  return {
    id: `grounded-${focuses.join("-") || "any"}-${Date.now()}`,
    format,
    focus: focuses[0] ?? "character",
    mode: "existing",
    depth: depth === "any" ? "warmup" : depth,
    text: out.text,
    question: format === "seed" ? out.question : undefined,
    constraint: format === "exercise" ? out.constraint : undefined,
    deeper: out.deeper || "Push the moment one beat further than is comfortable.",
    source: out.source || "grounded in your draft",
  };
}

type InspirationSnippet = { title: string; body: string; source?: string };

async function collectInspirationSnippets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<InspirationSnippet[]> {
  const out: InspirationSnippet[] = [];
  const { data: kernels } = await supabase
    .from("story_kernels")
    .select("title, body")
    .eq("user_id", userId);
  for (const k of kernels ?? []) {
    const body = String((k as { body?: string }).body ?? "").trim();
    if (body) out.push({ title: String((k as { title?: string }).title ?? ""), body });
  }
  const { data: insp } = await supabase
    .from("inspirations")
    .select("title, body, source")
    .eq("user_id", userId);
  for (const i of insp ?? []) {
    const body = String((i as { body?: string }).body ?? "").trim();
    if (body)
      out.push({
        title: String((i as { title?: string }).title ?? ""),
        body,
        source: String((i as { source?: string }).source ?? ""),
      });
  }
  return out;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Author an original prompt by BLENDING 2-3 of the writer's collected kernels /
 * inspirations (bisociation — force a connection between unrelated fragments).
 */
async function authorInspirationPrompt(
  focuses: PromptFocus[],
  depth: PromptDepth,
  format: PromptFormat,
  snippets: InspirationSnippet[],
): Promise<PromptObject | null> {
  const focusList = focuses.length ? focuses.join(" + ") : "open";
  const material = snippets
    .map(
      (s, i) =>
        `(${i + 1}) ${s.title ? s.title + " — " : ""}${s.body}${s.source ? `  [${s.source}]` : ""}`,
    )
    .join("\n\n");
  const formatGuidance =
    format === "seed"
      ? `Write a SCENARIO SEED: a concrete situation (named people, a specific place, mid-moment) in "text", plus an open craft question in "question".`
      : `Write a CRAFT EXERCISE: a clear instruction in "text" plus an explicit rule in "constraint".`;

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 700,
    system: `You author an original writing prompt by BLENDING two or three unrelated fragments of inspiration a writer has collected (lines, images, half-ideas from things they read or jotted down). Use bisociation: force a surprising connection BETWEEN the fragments so something new emerges. Never just restate one fragment, and never quote them at length — the result should feel generative and a little uncanny, clearly born from the collision.

${focusList !== "open" ? `Lean into this craft focus: ${focusList}. ` : ""}Depth: ${depth === "deep" ? "a substantial deep dive" : "a ~5-minute warm-up"}.

${formatGuidance}

Do NOT use placeholder slots — write it out fully. "deeper" = one escalation. "source" = a few words naming which fragments you blended. Call author_prompt; no prose.`,
    tools: [
      {
        name: "author_prompt",
        description: "Return a writing prompt blended from the inspirations.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string" },
            question: { type: "string" },
            constraint: { type: "string" },
            deeper: { type: "string" },
            source: { type: "string" },
          },
          required: ["text", "deeper"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "author_prompt" },
    messages: [
      {
        role: "user",
        content: `Fragments of inspiration to blend:\n\n${material}\n\nAuthor one ${format} prompt that blends them.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const out = toolUse?.input as
    | { text?: string; question?: string; constraint?: string; deeper?: string; source?: string }
    | undefined;
  if (!out?.text) return null;
  return {
    id: `inspo-${focuses.join("-") || "any"}-${Date.now()}`,
    format,
    focus: focuses[0] ?? "voice",
    mode: "new",
    depth: depth === "any" ? "warmup" : depth,
    text: out.text,
    question: format === "seed" ? out.question : undefined,
    constraint: format === "exercise" ? out.constraint : undefined,
    deeper: out.deeper || "Push the collision one beat further.",
    source: out.source || "blended from your inspirations",
  };
}

async function authorSeedMix(
  focuses: PromptFocus[],
  depth: PromptDepth,
): Promise<PromptObject | null> {
  const focusList = focuses.join(" + ");
  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 600,
    system: `You author "scenario seed" writing prompts for novelists. A scenario seed = a concrete, pre-populated SITUATION (named people in a specific place, mid-moment) PLUS an open craft QUESTION the writer answers by writing the scene.

You must genuinely BLEND the requested craft focuses into one prompt — not list them. ${depth === "deep" ? "Make it a meaty deep-dive." : "Keep it a light ~5-minute warm-up."}

Use these placeholder slots so the app can fill them with the writer's own characters/places when available:
- {{character}} and {{character2}} for people
- {{place}} for the setting
- {{thread}} for an unresolved tension
- {{object}} for a charged object
Use {{character}} and {{place}} at minimum. Write naturally around the slots.

Return via author_seed. The "text" is the situation (with slots). The "question" is the open craft question (it may include slots). The "deeper" is one escalation. "source" names the blended craft lineage in a few words.`,
    tools: [
      {
        name: "author_seed",
        description: "Return a scenario-seed prompt template.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string" },
            question: { type: "string" },
            deeper: { type: "string" },
            source: { type: "string" },
          },
          required: ["text", "question", "deeper"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "author_seed" },
    messages: [
      {
        role: "user",
        content: `Author one scenario-seed prompt that blends these craft focuses: ${focusList}.`,
      },
    ],
  });
  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const out = toolUse?.input as
    | { text?: string; question?: string; deeper?: string; source?: string }
    | undefined;
  if (!out?.text || !out.question) return null;
  return {
    id: `seed-mix-${focuses.join("-")}-${Date.now()}`,
    format: "seed",
    focus: focuses[0],
    mode: "both",
    depth: depth === "any" ? "warmup" : depth,
    text: out.text,
    question: out.question,
    deeper: out.deeper || "Push the moment one beat further than is comfortable.",
    source: out.source || `${focusList} blend`,
  };
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

/**
 * Move an exercise's "home".
 *  - projectId null  → return it to the standalone practice library.
 *  - projectId set   → CONVERT it into a real, scrollable project page
 *    (a loose scene), keeping the prompt as leading context, and remove the
 *    standalone exercise. Returns the new loose-scene id to navigate to.
 */
export async function moveExercise(
  id: string,
  projectId: string | null,
): Promise<{ looseId?: string }> {
  const { supabase, user } = await requireUser();

  if (projectId === null) {
    const { error } = await supabase
      .from("prompt_exercises")
      .update({ project_id: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
      throw new Error(error.message);
    }
    revalidatePath("/app", "layout");
    revalidatePath("/app/exercises");
    return {};
  }

  // Convert → loose scene.
  const { data: ex, error: readErr } = await supabase
    .from("prompt_exercises")
    .select("title, prompt, content, word_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr || !ex) {
    if (isMissingTable(readErr)) throw new Error(MIGRATION_REMINDER);
    throw new Error(readErr?.message ?? "exercise not found");
  }

  const promptText =
    (ex.prompt as { text?: string } | null)?.text ?? "Prompted page";
  const existing = (ex.content as { content?: unknown[] } | null)?.content ?? [
    { type: "paragraph" },
  ];
  const looseDoc = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: promptText }] },
        ],
      },
      ...existing,
    ],
  };

  const { data: loose, error: insErr } = await supabase
    .from("loose_scenes")
    .insert({
      user_id: user.id,
      project_id: projectId,
      title: (ex.title as string | null)?.trim() || promptText.slice(0, 80),
      content: looseDoc,
      word_count: (ex.word_count as number) ?? 0,
    })
    .select("id")
    .single();
  if (insErr || !loose) throw new Error(insErr?.message ?? "Could not create page");

  await supabase.from("prompt_exercises").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/app", "layout");
  revalidatePath("/app/exercises");
  return { looseId: loose.id as string };
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
