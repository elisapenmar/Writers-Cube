"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";

export type Character = {
  id: string;
  name: string;
  role: string | null;
  description: string;
  position: number;
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
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, role, description, position, updated_at")
    .eq("user_id", user.id)
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
  const { data: last } = await supabase
    .from("characters")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
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
  const { data: bs } = await supabase
    .from("brainstorms")
    .select("messages")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: proj } = await supabase
    .from("projects")
    .select("notes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
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
  - description: 2–4 sentences in the writer's own words wherever possible, weaving together what's been established. Don't editorialize.
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
    .eq("user_id", user.id);
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
