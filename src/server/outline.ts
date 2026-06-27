"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { guardAndSnapshot } from "@/server/versions";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  type OutlineNode,
  type OutlineTemplateKey,
  getTemplate,
} from "@/lib/outline-templates";

/** Count content-bearing nodes (any title/notes text) — for shrink detection. */
function countOutlineNodes(node: OutlineNode | null | undefined): number {
  if (!node) return 0;
  const hasText = Boolean(node.title?.trim()) || Boolean(node.notes?.trim());
  let n = hasText ? 1 : 0;
  for (const child of node.children ?? []) n += countOutlineNodes(child);
  return n;
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
    m.includes("outlines") && (m.includes("relation") || m.includes("does not exist"))
  );
}

const MIGRATION_REMINDER =
  "The 'outlines' table is missing in Supabase. Run the SQL in supabase/migrations/0004_outlines_table.sql via the SQL editor.";

export async function getOutline(): Promise<{
  tree: OutlineNode;
  template: OutlineTemplateKey;
} | null> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) return null;
  const { data, error } = await supabase
    .from("outlines")
    .select("tree, template")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    tree: data.tree as OutlineNode,
    template: (data.template as OutlineTemplateKey) ?? "custom",
  };
}

export async function chooseTemplate(
  templateKey: OutlineTemplateKey,
): Promise<{ tree: OutlineNode; template: OutlineTemplateKey }> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const template = getTemplate(templateKey);
  const tree = template.build();
  const { data: existing } = await supabase
    .from("outlines")
    .select("id")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("outlines")
      .update({
        tree,
        template: templateKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("outlines").insert({
      user_id: user.id,
      project_id: projectId,
      tree,
      template: templateKey,
    });
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
      throw new Error(error.message);
    }
  }
  revalidatePath("/app");
  return { tree, template: templateKey };
}

export async function saveOutline(tree: OutlineNode): Promise<void> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  if (!projectId) throw new Error("No project found");
  const { data: existing } = await supabase
    .from("outlines")
    .select("id, tree")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) {
    // Write-safety: snapshot the prior tree before an emptying/shrinking save.
    const priorTree = existing.tree as OutlineNode | null;
    await guardAndSnapshot(
      "outline",
      existing.id as string,
      priorTree,
      countOutlineNodes(priorTree),
      countOutlineNodes(tree),
    );
    const { error } = await supabase
      .from("outlines")
      .update({ tree, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("outlines").insert({
      user_id: user.id,
      project_id: projectId,
      tree,
      template: "custom",
    });
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_REMINDER);
      throw new Error(error.message);
    }
  }
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

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

async function gatherNotes(supabase: SupabaseLike, projectId: string | null): Promise<string> {
  if (!projectId) return "";
  const { data } = await supabase.from("projects").select("notes").eq("id", projectId).maybeSingle();
  return ((data?.notes as string | undefined) ?? "").trim();
}

async function gatherBrainstorm(supabase: SupabaseLike, userId: string, projectId: string | null): Promise<string> {
  if (!projectId) return "";
  const { data } = await supabase
    .from("brainstorms")
    .select("messages")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type Msg = { role: "user" | "assistant"; text: string };
  const messages = (data?.messages as Msg[] | undefined) ?? [];
  return messages
    .map((m) => (m.role === "user" ? `WRITER: ${m.text}` : `PARTNER: ${m.text}`))
    .join("\n\n")
    .trim();
}

async function gatherManuscript(supabase: SupabaseLike, projectId: string | null): Promise<string> {
  if (!projectId) return "";
  const { data: chapters } = await supabase.from("chapters").select("id").eq("project_id", projectId);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  if (chapterIds.length === 0) return "";
  const { data: scenes } = await supabase
    .from("scenes")
    .select("content")
    .in("chapter_id", chapterIds)
    .limit(80);
  let text = "";
  for (const s of scenes ?? []) {
    text += " " + plainTextFromDoc(s.content);
    if (text.length > 14000) break;
  }
  return text.slice(0, 14000).trim();
}

/** Core: fill empty outline sections from the given source material. */
async function runFill(
  tree: OutlineNode,
  sourceLabel: string,
  sourceText: string,
): Promise<OutlineNode> {
  if (!sourceText) {
    throw new Error(`Nothing in your ${sourceLabel} yet to draw from.`);
  }

  const flat: { id: string; path: string }[] = [];
  function walk(node: OutlineNode, path: string[]) {
    const fullPath = [...path, node.title].join(" › ");
    if (!node.notes || node.notes.trim() === "") flat.push({ id: node.id, path: fullPath });
    node.children.forEach((c) => walk(c, [...path, node.title]));
  }
  walk(tree, []);
  if (flat.length === 0) return tree;

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    system: `You are filling in sections of a novelist's story outline using her ${sourceLabel}. Never use em dashes; use commas or periods.

For each outline section listed below, return 2–4 short bullet points (NOT prose) of what happens there — one beat, fact, or turn per line, each line starting with "• ". Keep each bullet to a single clause where possible. Ground every bullet ONLY in the source material, using her own words and details.

If the material doesn't give you enough for a particular section, omit it (don't make things up). It's fine to skip sections.

Use the suggest_outline_content tool to return the filled sections.`,
    tools: [
      {
        name: "suggest_outline_content",
        description: "Return suggested content for outline sections.",
        input_schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "outline node id" },
                  content: { type: "string", description: "2–4 lines, each starting with '• '" },
                },
                required: ["id", "content"],
              },
            },
          },
          required: ["sections"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_outline_content" },
    messages: [
      {
        role: "user",
        content: `SOURCE (${sourceLabel.toUpperCase()}):\n\n${sourceText}\n\n---\n\nEMPTY OUTLINE SECTIONS (id — path):\n${flat
          .map((s) => `- ${s.id} — ${s.path}`)
          .join("\n")}\n\n---\n\nCall the tool now with suggested content for the sections you can fill.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const suggestions =
    (toolUse?.input as { sections?: { id: string; content: string }[] } | undefined)?.sections ?? [];
  const byId = new Map(suggestions.map((s) => [s.id, s.content]));

  function patch(node: OutlineNode): OutlineNode {
    const suggestion = byId.get(node.id);
    const next: OutlineNode = { ...node, children: node.children.map(patch) };
    if (suggestion && (!node.notes || node.notes.trim() === "")) next.notes = suggestion.trim();
    return next;
  }

  const updated = patch(tree);
  await saveOutline(updated);
  return updated;
}

/** Fill empty outline sections from the project's notes. */
export async function fillOutlineFromNotes(tree: OutlineNode): Promise<OutlineNode> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  return runFill(tree, "notes", await gatherNotes(supabase, projectId));
}

/** Fill empty outline sections from the project's brainstorm conversation. */
export async function fillOutlineFromBrainstorm(tree: OutlineNode): Promise<OutlineNode> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  return runFill(tree, "brainstorm", await gatherBrainstorm(supabase, user.id, projectId));
}

/** Fill empty outline sections from the project's manuscript prose. */
export async function fillOutlineFromManuscript(tree: OutlineNode): Promise<OutlineNode> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  return runFill(tree, "manuscript", await gatherManuscript(supabase, projectId));
}
