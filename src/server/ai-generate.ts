"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { htmlToPlainText } from "@/lib/html-text";
import type { MindMapNode } from "@/server/brainstorm";
import type { SavedMindMap } from "@/server/mindmap";
import type { TimelineState, TimelineLane } from "@/server/timeline";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
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

/** Gather a project's manuscript prose (capped) + notes for AI grounding. */
async function gatherStory(projectId: string) {
  const { supabase } = await requireUser();
  const { data: project } = await supabase
    .from("projects")
    .select("notes")
    .eq("id", projectId)
    .maybeSingle();
  const notes = htmlToPlainText((project?.notes as string | undefined) ?? "").trim();

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const chapterIds = (chapters ?? []).map((c) => c.id);
  let manuscript = "";
  if (chapterIds.length > 0) {
    const { data: scenes } = await supabase
      .from("scenes")
      .select("chapter_id, content")
      .in("chapter_id", chapterIds)
      .limit(80);
    for (const s of scenes ?? []) {
      manuscript += " " + plainTextFromDoc(s.content);
      if (manuscript.length > 16000) break;
    }
  }
  return { notes, manuscript: manuscript.slice(0, 16000).trim() };
}

const LANE_COLORS = ["#7c8a9a", "#a8826d", "#8a7c9a", "#6d8a7c", "#9a8a6d", "#7c9aa8"];
function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Build a thought map from the project's manuscript + notes. */
export async function generateMindMapFromManuscript(): Promise<{ nodes: MindMapNode[] }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");
  const { notes, manuscript } = await gatherStory(projectId);
  if (!manuscript && !notes) {
    throw new Error("Nothing to read yet — write or import some scenes first.");
  }

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system: `You map a novelist's story into a thought map (a tree of short nodes).
- Start from a single root node = the story's core (title or central premise).
- Children branch into the major elements you actually see in the text: main characters, central conflict, setting, key threads/themes.
- Each node label is 1–6 words, in the writer's own words where possible.
- Don't invent material that isn't supported by the text.
Call render_thought_map. No prose.`,
    tools: [
      {
        name: "render_thought_map",
        description: "Render the story as a thought-map graph.",
        input_schema: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "short slug id" },
                  label: { type: "string", description: "1–6 word phrase" },
                  parent: { type: "string", description: "parent id; omit for root" },
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
        content: `NOTES:\n${notes || "(none)"}\n\nMANUSCRIPT EXCERPT:\n${manuscript || "(none)"}\n\nProduce the thought map now.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const raw = (toolUse?.input as { nodes?: MindMapNode[] } | undefined)?.nodes ?? [];
  const nodes: MindMapNode[] = raw
    .filter((n) => n && n.id && n.label)
    .map((n) => ({ id: String(n.id), label: String(n.label), parent: n.parent ? String(n.parent) : null }));

  const state: SavedMindMap = { nodes, positions: {} };
  await supabase
    .from("projects")
    .update({ mind_map: state, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath("/app");
  return { nodes };
}

/** Build a timeline (lanes of events) from the project's manuscript + notes. */
export async function generateTimelineFromManuscript(): Promise<TimelineState> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found.");
  const { notes, manuscript } = await gatherStory(projectId);
  if (!manuscript && !notes) {
    throw new Error("Nothing to read yet — write or import some scenes first.");
  }

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    system: `You extract a story timeline from a novelist's manuscript + notes.
- Identify the key events in the order they happen in the story's chronology.
- Group them into 1–3 lanes ("tracks") only if the story clearly has parallel threads (e.g. two POVs, two timeframes). Otherwise use a single lane.
- Each event: a short title, a "when" label using whatever time cues the text gives ("Day 1", "That night", "Twenty years earlier", "Chapter 3"), and a one-sentence note.
- Only include events actually present in the text. Don't invent.
Call build_timeline. No prose.`,
    tools: [
      {
        name: "build_timeline",
        description: "Return the story timeline as lanes of ordered events.",
        input_schema: {
          type: "object",
          properties: {
            lanes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        when: { type: "string" },
                        notes: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["name", "events"],
              },
            },
          },
          required: ["lanes"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "build_timeline" },
    messages: [
      {
        role: "user",
        content: `NOTES:\n${notes || "(none)"}\n\nMANUSCRIPT EXCERPT:\n${manuscript || "(none)"}\n\nBuild the timeline now.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  type RawLane = { name: string; events?: { title: string; when?: string; notes?: string }[] };
  const rawLanes = (toolUse?.input as { lanes?: RawLane[] } | undefined)?.lanes ?? [];

  const lanes: TimelineLane[] = rawLanes.map((lane, li) => ({
    id: uid("lane"),
    name: lane.name || `Track ${li + 1}`,
    color: LANE_COLORS[li % LANE_COLORS.length],
    events: (lane.events ?? []).map((e) => ({
      id: uid("ev"),
      title: e.title || "Untitled event",
      when: e.when || "",
      notes: e.notes || "",
    })),
  }));

  const state: TimelineState = { lanes };
  await supabase
    .from("projects")
    .update({ timeline: state, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath("/app");
  return state;
}
