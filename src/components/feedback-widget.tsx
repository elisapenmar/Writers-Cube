"use client";

import { useRef, useState } from "react";
import { submitFeedback, type FeedbackCategory } from "@/server/feedback";

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string; emoji: string }[] = [
  { value: "praise", label: "Love it", hint: "Praise a feature that's working for you", emoji: "💛" },
  { value: "issue", label: "Something's off", hint: "Broken, confusing, or rough UX", emoji: "🐛" },
  { value: "suggestion", label: "Suggest a feature", hint: "An idea or request", emoji: "💡" },
];

const FACES = [
  { rating: 1, emoji: "😞", label: "Frustrated" },
  { rating: 2, emoji: "🙁", label: "Unhappy" },
  { rating: 3, emoji: "😐", label: "Neutral" },
  { rating: 4, emoji: "🙂", label: "Good" },
  { rating: 5, emoji: "😄", label: "Love it" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("praise");
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCategory("praise");
    setRating(null);
    setTitle("");
    setBody("");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    setOpen(false);
    // Reset after the panel animates away so a re-open is fresh.
    setTimeout(() => {
      setDone(false);
      reset();
    }, 200);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() && !body.trim()) {
      setError("Add a title or a short description.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("category", category);
      if (rating != null) fd.set("rating", String(rating));
      fd.set("title", title);
      fd.set("body", body);
      fd.set("pageUrl", typeof window !== "undefined" ? window.location.pathname : "");
      const f = fileRef.current?.files?.[0];
      if (f) fd.set("screenshot", f);
      await submitFeedback(fd);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Desktop-only: the floating widget collides with the mobile tab bar, so it
    // is hidden on phones for now. `md:` = the 768px mobile breakpoint, so this
    // shows from tablet width up. (If we want beta feedback on phones later, add
    // an entry to the mobile "More" drawer rather than re-floating this.)
    <div className="hidden md:block">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-[var(--wc-slate)] px-4 py-2.5 text-sm font-medium text-[var(--wc-on-accent)] shadow-lg hover:brightness-105"
          title="Send feedback"
        >
          <span aria-hidden>💬</span> Feedback
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-[var(--wc-shadow-md)]">
          <div className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-2.5">
            <span className="font-serif text-base text-[var(--wc-ink)]">Send feedback</span>
            <button
              onClick={close}
              className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
              aria-label="Close feedback"
            >
              ✕
            </button>
          </div>

          {done ? (
            <div className="px-4 py-8 text-center">
              <div className="text-3xl" aria-hidden>🙏</div>
              <p className="mt-2 font-serif text-lg text-[var(--wc-ink)]">Thank you!</p>
              <p className="mt-1 text-sm text-[var(--wc-muted)]">
                Your note is in. We read every one to triage and improve the app.
              </p>
              <button
                onClick={close}
                className="mt-4 rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] px-3 py-1.5 text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3">
              {/* Category */}
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    title={c.hint}
                    className={`flex flex-col items-center gap-1 rounded-[var(--wc-r-md)] border px-1 py-2 text-[11px] leading-tight ${
                      category === c.value
                        ? "border-[var(--wc-slate)] bg-[var(--wc-canvas)] text-[var(--wc-ink)]"
                        : "border-[var(--wc-border)] text-[var(--wc-muted)] hover:border-[var(--wc-border-strong)]"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Emoji scale */}
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--wc-faint)]">
                  How are you feeling?
                </div>
                <div className="flex justify-between">
                  {FACES.map((f) => (
                    <button
                      key={f.rating}
                      type="button"
                      onClick={() => setRating(rating === f.rating ? null : f.rating)}
                      title={f.label}
                      aria-pressed={rating === f.rating}
                      className={`grid h-9 w-9 place-items-center rounded-full text-xl transition ${
                        rating === f.rating
                          ? "bg-[var(--wc-canvas)] ring-2 ring-[var(--wc-slate)]"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <span aria-hidden>{f.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={200}
                className="w-full rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-2.5 py-1.5 text-sm text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)]"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell us more…"
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-2.5 py-1.5 text-sm text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)]"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] px-2.5 py-1.5 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
                >
                  📎 Attach screenshot
                </button>
                {fileName && (
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--wc-faint)]">{fileName}</span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[var(--wc-r-md)] px-3 py-2 text-sm font-medium text-[var(--wc-on-accent)] transition hover:brightness-105 disabled:opacity-50"
                style={{ background: "var(--wc-slate)" }}
              >
                {submitting ? "Sending…" : "Send feedback"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
