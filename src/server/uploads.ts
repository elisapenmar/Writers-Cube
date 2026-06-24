"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "rte-images";

/** Upload an image to Supabase Storage and return its public URL. */
export async function uploadRteImage(formData: FormData): Promise<{ url: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an image to insert.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Images must be under 10 MB.");
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${crypto.randomUUID()}.${ext || "png"}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
