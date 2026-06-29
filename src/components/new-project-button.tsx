"use client";

import { createProjectAndOpen } from "@/server/projects";
import { PROJECT_FORMS, FORM_TERMS } from "@/lib/project-forms";

/** "New project" action: pick the kind of writing, then create + open it.
 *  `createProjectAndOpen` already reads `form` from the submitted FormData. */
export function NewProjectButton({ variant = "inline" }: { variant?: "inline" | "card" }) {
  const select = (
    <select
      name="form"
      defaultValue="novel"
      aria-label="What kind of writing is this?"
      title="What kind of writing is this?"
      className="rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] bg-[var(--wc-paper)] px-2 py-1.5 text-sm text-[var(--wc-ink)]"
    >
      {PROJECT_FORMS.map((f) => (
        <option key={f} value={f}>
          {FORM_TERMS[f].label}
        </option>
      ))}
    </select>
  );

  if (variant === "card") {
    return (
      <form
        action={createProjectAndOpen}
        className="rounded-2xl p-4 border border-dashed border-[var(--wc-border-strong)] bg-transparent flex flex-col items-center justify-center gap-2"
      >
        {select}
        <button
          type="submit"
          className="rounded-lg px-3 py-1.5 text-sm text-[var(--wc-on-accent)]"
          style={{ background: "var(--wc-slate)" }}
        >
          ＋ New project
        </button>
      </form>
    );
  }

  return (
    <form action={createProjectAndOpen} className="flex items-center gap-2">
      {select}
      <button
        type="submit"
        className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105"
        style={{ background: "var(--wc-slate)" }}
      >
        ＋ New project
      </button>
    </form>
  );
}
