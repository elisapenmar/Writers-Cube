"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** The writer's accepted words (their personal spell-check dictionary). */
export async function listDictionaryWords(): Promise<string[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_dictionary")
    .select("word")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.word as string);
}

export async function addDictionaryWord(word: string): Promise<void> {
  const w = word.trim();
  if (!w) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_dictionary")
    .upsert({ user_id: user.id, word: w }, { onConflict: "user_id,word" });
  if (error) throw new Error(error.message);
}

export async function removeDictionaryWord(word: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_dictionary")
    .delete()
    .eq("user_id", user.id)
    .eq("word", word.trim());
  if (error) throw new Error(error.message);
}
