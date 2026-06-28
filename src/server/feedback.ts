"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SCREENSHOT_BUCKET = "rte-images";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "elisa.penmar@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type FeedbackCategory = "praise" | "issue" | "suggestion";
export type FeedbackStatus = "new" | "triaged" | "resolved";

export type FeedbackEntry = {
  id: string;
  user_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  rating: number | null;
  title: string;
  body: string;
  screenshot_url: string | null;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function adminOrThrow(email: string | undefined) {
  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
    throw new Error("Not authorized.");
  }
}

/** Whether the current user may view the feedback admin page. */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/** Store a feedback entry (with an optional screenshot) from the widget. */
export async function submitFeedback(form: FormData): Promise<{ ok: true }> {
  const { supabase, user } = await requireUser();

  const category = String(form.get("category") || "");
  if (!["praise", "issue", "suggestion"].includes(category)) {
    throw new Error("Pick a category.");
  }
  const ratingRaw = Number(form.get("rating"));
  const rating =
    Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null;
  const title = String(form.get("title") || "").slice(0, 200);
  const body = String(form.get("body") || "").slice(0, 5000);
  const pageUrl = String(form.get("pageUrl") || "").slice(0, 500);
  if (!title.trim() && !body.trim()) {
    throw new Error("Add a title or a short description.");
  }

  let screenshotUrl: string | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) throw new Error("Screenshot must be an image.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Screenshot must be under 10 MB.");
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${user.id}/feedback/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!upErr) {
      screenshotUrl = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    email: user.email ?? null,
    category,
    rating,
    title,
    body,
    screenshot_url: screenshotUrl,
    page_url: pageUrl || null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Admin-only: all feedback, newest first. */
export async function listFeedback(): Promise<FeedbackEntry[]> {
  const { supabase, user } = await requireUser();
  adminOrThrow(user.email);
  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, user_id, email, category, rating, title, body, screenshot_url, page_url, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackEntry[];
}

/** Admin-only: triage a feedback entry. */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { supabase, user } = await requireUser();
  adminOrThrow(user.email);
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
