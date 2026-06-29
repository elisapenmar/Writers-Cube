"use server";

// Server actions backing the Corkboard panel (Stream A, Wave 1). Reorder within
// a chapter / reorder chapters reuse the existing actions in `scenes.ts`; this
// file only adds what the corkboard needs on top: editing a scene's synopsis and
// moving a scene to a different chapter.

import { revalidatePath } from "next/cache";
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

/** Save (or clear) the one-line synopsis shown on a scene's index card. */
export async function updateSceneSynopsis(sceneId: string, synopsis: string): Promise<void> {
  const { supabase } = await requireUser();
  const trimmed = synopsis.trim().slice(0, 2000);
  const { error } = await supabase
    .from("scenes")
    .update({ synopsis: trimmed || null })
    .eq("id", sceneId);
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

/**
 * Move a scene into another chapter, appending it to the end of the target
 * chapter and re-packing the source chapter so positions stay contiguous.
 */
export async function moveSceneToChapter(
  sceneId: string,
  targetChapterId: string,
): Promise<void> {
  const { supabase } = await requireUser();

  const { data: scene, error: readErr } = await supabase
    .from("scenes")
    .select("id, chapter_id, position")
    .eq("id", sceneId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!scene) throw new Error("Scene not found");
  const fromChapterId = scene.chapter_id as string;
  if (fromChapterId === targetChapterId) return;

  // Append to the end of the target chapter.
  const { data: last } = await supabase
    .from("scenes")
    .select("position")
    .eq("chapter_id", targetChapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? -1) + 1;

  const { error: moveErr } = await supabase
    .from("scenes")
    .update({ chapter_id: targetChapterId, position: nextPosition })
    .eq("id", sceneId);
  if (moveErr) throw new Error(moveErr.message);

  // Close the gap left behind in the source chapter.
  const { data: rest } = await supabase
    .from("scenes")
    .select("id")
    .eq("chapter_id", fromChapterId)
    .order("position", { ascending: true });
  await Promise.all(
    (rest ?? []).map((s, position) =>
      supabase.from("scenes").update({ position }).eq("id", s.id),
    ),
  );

  revalidatePath("/app", "layout");
}
