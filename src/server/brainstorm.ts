"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { snapshotContent } from "@/server/versions";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import type { BrainstormMode } from "@/lib/brainstorm-modes";

export type { BrainstormMode } from "@/lib/brainstorm-modes";

export type BrainstormRole = "user" | "assistant";
export type BrainstormMessage = {
  role: BrainstormRole;
  text: string;
};

export type BrainstormSummary = {
  id: string;
  title: string | null;
  summary: string | null;
  mode: BrainstormMode;
  message_count: number;
  created_at: string;
  updated_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const OPEN_SYSTEM_PROMPT = `You are a thoughtful interview partner helping a novelist develop a story idea.

Your style:
- Ask ONE question per turn. Never more.
- Keep your responses brief — 1–3 sentences, ideally one.
- Listen carefully and build on what the writer just said. Reflect a phrase of theirs back if it shows you heard them.
- Vary the angles you probe: character, world, stakes, theme, emotional core, the seed image or scene the writer keeps coming back to.
- When something feels rich, slow down and dig into it — don't skip ahead.
- Avoid generic writing-advice prompts. Stay specific to what the writer has actually said.
- Never offer suggestions or your own ideas unless the writer asks. Your role is to draw out theirs.
- Don't summarize. Don't recap. Just ask the next question.

If this is the first turn (writer's first message in the conversation), open with a warm acknowledgement plus one focused question.

IMPORTANT — when the writer asks for a visual, mind map, thought map, diagram, flowchart, outline, summary, or any organized/structured view of what we've discussed:
- Do NOT attempt to draw or render it in chat (no ASCII art, no markdown headings, no bullet diagrams).
- Instead, point them to the "Organize this…" button at the top right of the screen — it generates a real outline or a draggable, editable thought map in its own panel.
- Reply in one sentence: e.g., "Hit the Organize this… button at the top right and pick Thought map — it'll lay it out as a real graph you can rearrange."
- Then resume the conversation with a normal next question on your following turn.`;

const BACKWARD_SYSTEM_PROMPT = `You are a thoughtful interview partner helping a novelist develop a story idea using REVERSE OUTLINING — starting from the ending and working backward.

The shape of the conversation:
1. First, ground the writer in the ENDING. Ask about the final scene, the final image, the protagonist's last state. Don't rush past this — sit in the ending for a few turns until it has texture.
2. Then, slowly walk backward:
   - What event/decision/realization made this ending possible? (the climax)
   - What was the dark night before that? What did the protagonist almost give up on?
   - What was the midpoint shift that moved them from passive to active?
   - What was the inciting incident — the thing that broke the status quo?
   - What was the false belief or world the story opened in?
3. Take only one step backward at a time. If the writer's answer is vague, dig in before stepping back again.

Style rules:
- Ask ONE question per turn. Never more.
- Keep your responses brief — 1–3 sentences, ideally one.
- Listen carefully and build on what the writer just said. Reflect a phrase of theirs back if it shows you heard them.
- Never offer suggestions or your own ideas unless the writer asks. Your role is to draw out hers.
- Don't summarize. Don't recap. Just ask the next question.

If this is the first turn, open with a warm acknowledgement and a question about the very last scene — the final image she wants the reader to close the book on.

IMPORTANT — when the writer asks for a visual, mind map, diagram, outline, or organized view:
- Do NOT attempt to draw or render it in chat.
- Point them to the "Organize this…" button at the top right.
- Reply in one sentence, then resume with your next backward question.`;

const SYSTEM_PROMPTS: Record<BrainstormMode, string> = {
  open: OPEN_SYSTEM_PROMPT,
  backward: BACKWARD_SYSTEM_PROMPT,
};

export async function listBrainstorms(): Promise<BrainstormSummary[]> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  let q = supabase
    .from("brainstorms")
    .select("id, title, summary, mode, messages, created_at, updated_at")
    .eq("user_id", user.id);
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((b) => {
    const msgs = (b.messages as BrainstormMessage[] | null) ?? [];
    return {
      id: b.id as string,
      title: (b.title as string | null) ?? null,
      summary: (b.summary as string | null) ?? null,
      mode: ((b.mode as BrainstormMode) ?? "open") as BrainstormMode,
      message_count: msgs.length,
      created_at: b.created_at as string,
      updated_at: b.updated_at as string,
    };
  });
}

/**
 * Get a brainstorm by id (or the most-recent one if no id is given).
 * Creates a fresh brainstorm if the user has none.
 */
export async function getBrainstorm(id?: string): Promise<{
  id: string;
  messages: BrainstormMessage[];
  mode: BrainstormMode;
  title: string | null;
  summary: string | null;
}> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  let row;
  if (id) {
    // Validate the id belongs to the ACTIVE project — a persisted id from
    // another project must not leak its conversation in here.
    let q = supabase
      .from("brainstorms")
      .select("id, messages, mode, title, summary")
      .eq("id", id)
      .eq("user_id", user.id);
    q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
    const { data } = await q.maybeSingle();
    row = data;
  } else {
    let q = supabase
      .from("brainstorms")
      .select("id, messages, mode, title, summary")
      .eq("user_id", user.id);
    q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
    const { data } = await q
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  }
  if (row) {
    return {
      id: row.id as string,
      messages: (row.messages as BrainstormMessage[]) ?? [],
      mode: (row.mode as BrainstormMode) ?? "open",
      title: (row.title as string | null) ?? null,
      summary: (row.summary as string | null) ?? null,
    };
  }
  // None yet — create one for this project
  const { data: created, error } = await supabase
    .from("brainstorms")
    .insert({ user_id: user.id, project_id: projectId, messages: [] })
    .select("id, messages, mode, title, summary")
    .single();
  if (error || !created) throw new Error(error?.message ?? "create brainstorm failed");
  return {
    id: created.id as string,
    messages: [],
    mode: "open",
    title: null,
    summary: null,
  };
}

export async function createBrainstorm(): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  const { data, error } = await supabase
    .from("brainstorms")
    .insert({ user_id: user.id, project_id: projectId, messages: [], mode: "open" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  revalidatePath("/app/brainstorm");
  return { id: data.id as string };
}

export async function deleteBrainstorm(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("brainstorms")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/brainstorm");
}

export async function updateBrainstormTitle(
  id: string,
  title: string,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = title.trim().slice(0, 120) || null;
  const { error } = await supabase
    .from("brainstorms")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/brainstorm");
}

export async function setBrainstormMode(
  id: string,
  mode: BrainstormMode,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("brainstorms")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/brainstorm");
}

export async function sendBrainstormMessage(
  brainstormId: string,
  userText: string,
): Promise<{
  messages: BrainstormMessage[];
  title: string | null;
  summary: string | null;
}> {
  const { supabase, user } = await requireUser();
  const trimmed = userText.trim();
  if (!trimmed) throw new Error("Empty message");

  const { data: existing } = await supabase
    .from("brainstorms")
    .select("id, messages, mode, title, summary")
    .eq("id", brainstormId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) throw new Error("Brainstorm not found");

  let messages: BrainstormMessage[] =
    (existing.messages as BrainstormMessage[] | undefined) ?? [];
  const mode: BrainstormMode = (existing.mode as BrainstormMode) ?? "open";
  let title = (existing.title as string | null) ?? null;
  let summary = (existing.summary as string | null) ?? null;

  messages = [...messages, { role: "user", text: trimmed }];

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPTS[mode],
    messages: messages.map((m) => ({
      role: m.role,
      content: m.text,
    })),
  });

  const replyText = completion.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  messages = [...messages, { role: "assistant", text: replyText }];

  // Auto-title on first AI response if none set; refresh summary every turn.
  if (!title) {
    title = await generateBrainstormTitle(messages).catch(() => null);
  }
  // Only generate summary once we have a reasonable amount of content.
  if (messages.length >= 2) {
    summary = await generateBrainstormSummary(messages).catch(() => summary);
  }

  const { error: updateErr } = await supabase
    .from("brainstorms")
    .update({
      messages,
      title,
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brainstormId);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/app/brainstorm");
  return { messages, title, summary };
}

async function generateBrainstormTitle(
  messages: BrainstormMessage[],
): Promise<string | null> {
  const transcript = messages
    .slice(0, 6)
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n");
  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 40,
    system:
      "Generate a 3–6 word title for this brainstorm session, capturing its central seed or theme. Use the writer's words where possible. Title case. No quotation marks. No trailing period. Just the title — no preamble.",
    messages: [{ role: "user", content: transcript }],
  });
  const text = completion.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\.$/, "")
    .slice(0, 80);
  return text || null;
}

async function generateBrainstormSummary(
  messages: BrainstormMessage[],
): Promise<string | null> {
  const transcript = messages
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n");
  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 100,
    system:
      "Summarize what this brainstorm is about in a single sentence (15–25 words). Use the writer's own words where possible. No preamble. Just the sentence.",
    messages: [{ role: "user", content: transcript }],
  });
  const text = completion.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join(" ")
    .trim()
    .slice(0, 240);
  return text || null;
}

export type OrganizeFormat = "notes" | "mindmap";

export type MindMapNode = {
  id: string;
  label: string;
  parent?: string | null;
};

export type OrganizeResult =
  | { format: "notes"; text: string }
  | { format: "mindmap"; nodes: MindMapNode[] };

const NOTES_FRESH_PROMPT = `You're organizing a novelist's brainstorm into a set of working notes she can read and edit. These are notes, not an outline — group ideas thematically, not chronologically.

Style:
- Use Markdown headings (\`##\` for top-level themes; \`###\` for sub-themes if needed).
- Under each heading, plain bullet points or short paragraphs in the writer's OWN words wherever possible.
- Cover whatever themes she actually talked about: characters, setting, conflict, themes, images, open questions, story-shape ideas. Leave out themes she didn't mention rather than inventing.
- Quote distinctive phrases of hers in italic, like *"a connection deeper than most relationships"*, so she recognizes her own voice.
- Don't summarize generically. Don't editorialize. Don't add your own interpretation.
- No closing paragraph, no preamble, no "Let me know if…" sign-off. Just the notes.`;

const NOTES_MERGE_PROMPT = `You're updating a novelist's working notes after another round of brainstorming.

You have two inputs:
1. EXISTING NOTES — the writer's current notes, which she may have edited by hand. PRESERVE these. Do not rewrite, rephrase, or "clean them up". Keep her wording exactly. Keep her structure.
2. RECENT CONVERSATION — new exchanges between the writer and her thought partner.

Your job:
- Extract new ideas, characters, settings, themes, conflicts, or quotes from the RECENT CONVERSATION that aren't already in the notes.
- ADD them to the existing notes under the appropriate heading. Create a new heading only if no existing one fits.
- Mark new bullet points with a leading "✦" so the writer can spot what was just added.
- Output the FULL updated notes (existing + new), nothing else. No preamble, no commentary.
- If no new content is worth adding, output the existing notes unchanged.`;

const MINDMAP_SYSTEM = `You are organizing a writer's brainstorm into a thought map (a graph of connected nodes).

Rules:
- Identify the seed/core idea as the ROOT node (omit parent).
- Branch outward into the main facets the writer brought up: characters, setting, themes, conflicts, images, open questions, etc. Each is a child of the root.
- Group sub-ideas under their parent. Use up to 3 levels of nesting (root, branches, sub-branches). Only go deeper when there's a genuinely useful sub-sub-grouping; deep nesting clutters the map.
- AIM FOR FEWER, BETTER GROUPS at the top level. Prefer 4–7 branches under the root, each with a few children, over 15 flat branches. A balanced tree maps cleanly; a flat starburst spreads forever.
- Every node's "parent" field MUST be the id of an existing node in your output (or omitted if it's the root). Do not invent parent ids.
- Each label is a short phrase or noun-phrase (1–6 words), in the writer's OWN words wherever possible. Never a full sentence. Never your interpretation.
- 10–25 nodes total is a healthy range. Don't pad.

Call the render_thought_map tool with the node list. Do not write any text in your response.`;

function isMissingNotesColumn(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("notes") && (m.includes("column") || m.includes("does not exist"));
}

const MIGRATION_REMINDER =
  "The 'notes' column is missing on projects. Run: alter table projects add column if not exists notes text not null default '';";

export async function getNotes(): Promise<string> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return "";
  const { data, error } = await supabase
    .from("projects")
    .select("notes")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    if (isMissingNotesColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  return (data?.notes as string | undefined) ?? "";
}

export async function saveNotes(text: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");

  // Write-safety: snapshot prior notes before an emptying/shrinking save.
  const { data: cur } = await supabase
    .from("projects")
    .select("notes")
    .eq("id", projectId)
    .maybeSingle();
  const curText = ((cur?.notes as string | null) ?? "").trim();
  const next = text.trim();
  const shrink =
    (next.length === 0 && curText.length > 0) ||
    (curText.length >= 200 && next.length < curText.length * 0.5);
  if (curText && shrink) {
    await snapshotContent("notes", projectId, curText, { force: true });
  }

  const { error } = await supabase
    .from("projects")
    .update({ notes: text, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) {
    if (isMissingNotesColumn(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  await snapshotContent("notes", projectId, text);
  revalidatePath("/app/brainstorm");
}

export async function organizeBrainstorm(
  format: OrganizeFormat,
): Promise<OrganizeResult> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  // Latest brainstorm conversation for this project
  let bsQ = supabase
    .from("brainstorms")
    .select("messages")
    .eq("user_id", user.id);
  bsQ = projectId ? bsQ.eq("project_id", projectId) : bsQ.is("project_id", null);
  const { data: latestBs } = await bsQ
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const messages = (latestBs?.messages as BrainstormMessage[] | undefined) ?? [];

  // Project-level notes for the active project.
  const { data: project, error: projErr } = projectId
    ? await supabase.from("projects").select("notes").eq("id", projectId).maybeSingle()
    : { data: null, error: null };
  if (projErr) {
    if (isMissingNotesColumn(projErr)) throw new Error(MIGRATION_REMINDER);
    throw new Error(projErr.message);
  }
  const existingNotes = ((project?.notes as string | undefined) ?? "").trim();

  if (messages.length === 0) {
    if (format === "notes") {
      return {
        format: "notes",
        text:
          existingNotes ||
          "Nothing to organize yet — say something to your thought partner first.",
      };
    }
    return { format: "mindmap", nodes: [] };
  }

  const transcript = messages
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n");

  const anthropic = getAnthropic();

  if (format === "notes") {
    let text: string;
    if (existingNotes) {
      const completion = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: NOTES_MERGE_PROMPT,
        messages: [
          {
            role: "user",
            content: `EXISTING NOTES:\n\n${existingNotes}\n\n---\n\nRECENT CONVERSATION:\n\n${transcript}\n\n---\n\nOutput the updated notes now.`,
          },
        ],
      });
      text = completion.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
    } else {
      const completion = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system: NOTES_FRESH_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here is the conversation transcript:\n\n${transcript}\n\nProduce the notes now.`,
          },
        ],
      });
      text = completion.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
    }
    // Persist the updated notes immediately
    if (text) {
      await saveNotes(text);
    }
    return { format: "notes", text };
  }

  // mindmap: structured output via tool use
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system: MINDMAP_SYSTEM,
    tools: [
      {
        name: "render_thought_map",
        description: "Render the writer's brainstorm as a thought map graph.",
        input_schema: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Short slug id" },
                  label: { type: "string", description: "1–6 word phrase, writer's own words where possible" },
                  parent: { type: "string", description: "id of the parent node; omit for the root" },
                },
                required: ["id", "label"],
              },
            },
          },
          required: ["nodes"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "render_thought_map" },
    messages: [
      {
        role: "user",
        content: `Here is the conversation transcript:\n\n${transcript}\n\nProduce the thought map now.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const rawNodes =
    (toolUse?.input as { nodes?: MindMapNode[] } | undefined)?.nodes ?? [];
  const nodes: MindMapNode[] = rawNodes
    .filter((n) => n && n.id && n.label)
    .map((n) => ({
      id: String(n.id),
      label: String(n.label),
      parent: n.parent ? String(n.parent) : null,
    }));

  // Persist the freshly generated map so positions can be tracked alongside.
  // Manual positions reset on regenerate (this is destructive — UI warns users).
  try {
    if (projectId) {
      await supabase
        .from("projects")
        .update({
          mind_map: { nodes, positions: {} },
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    }
  } catch {
    // mind_map column may be missing; mindmap.ts helpers will surface the migration reminder.
  }

  return { format: "mindmap", nodes };
}

export async function resetBrainstorm(brainstormId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("brainstorms")
    .update({
      messages: [],
      title: null,
      summary: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brainstormId)
    .eq("user_id", user.id);
  revalidatePath("/app/brainstorm");
}
