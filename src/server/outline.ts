"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/server/project-context";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  type OutlineNode,
  type OutlineTemplateKey,
  getTemplate,
} from "@/lib/outline-templates";

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
    .select("id")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) {
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

/**
 * Ask Claude to suggest content for any empty leaf nodes in the outline,
 * grounded in the writer's brainstorm notes. Returns an updated tree;
 * existing non-empty notes are preserved.
 */
export async function fillOutlineFromNotes(tree: OutlineNode): Promise<OutlineNode> {
  const { supabase, user } = await requireUser();
  const projectId = await resolveProjectId(supabase, user.id);
  const { data: project } = projectId
    ? await supabase.from("projects").select("notes").eq("id", projectId).maybeSingle()
    : { data: null };
  const notes = ((project?.notes as string | undefined) ?? "").trim();
  if (!notes) {
    throw new Error(
      "No notes yet. Run a brainstorm session and generate notes first.",
    );
  }

  // Collect empty leaves (nodes whose `notes` is blank, regardless of children)
  // for the AI to fill. Pass the entire structure so it understands context.
  const flat: { id: string; path: string }[] = [];
  function walk(node: OutlineNode, path: string[]) {
    const fullPath = [...path, node.title].join(" › ");
    if (!node.notes || node.notes.trim() === "") {
      flat.push({ id: node.id, path: fullPath });
    }
    node.children.forEach((c) => walk(c, [...path, node.title]));
  }
  walk(tree, []);

  if (flat.length === 0) return tree;

  const anthropic = getAnthropic();
  const completion = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    system: `You are filling in sections of a novelist's story outline using her brainstorm notes.

For each outline section listed below, write a brief paragraph (1–3 sentences) describing what happens in that section, grounded ONLY in the writer's notes. Use her own words and details wherever possible.

If the notes don't give you enough material for a particular section, omit that section (don't make things up). It's fine to skip sections.

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
                  content: { type: "string", description: "1–3 sentence draft" },
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
        content: `BRAINSTORM NOTES:\n\n${notes}\n\n---\n\nEMPTY OUTLINE SECTIONS (id — path):\n${flat
          .map((s) => `- ${s.id} — ${s.path}`)
          .join("\n")}\n\n---\n\nCall the tool now with suggested content for the sections you can fill from the notes.`,
      },
    ],
  });

  const toolUse = completion.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  const suggestions =
    (toolUse?.input as { sections?: { id: string; content: string }[] } | undefined)
      ?.sections ?? [];

  const byId = new Map(suggestions.map((s) => [s.id, s.content]));

  function patch(node: OutlineNode): OutlineNode {
    const suggestion = byId.get(node.id);
    const next: OutlineNode = {
      ...node,
      children: node.children.map(patch),
    };
    if (suggestion && (!node.notes || node.notes.trim() === "")) {
      next.notes = suggestion.trim();
    }
    return next;
  }

  const updated = patch(tree);
  await saveOutline(updated);
  return updated;
}
