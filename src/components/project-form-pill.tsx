"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectForm } from "@/server/scenes";
import { PROJECT_FORMS, FORM_TERMS, asForm, type ProjectForm } from "@/lib/project-forms";

/** A small pill in the side nav showing the project's form; click to change it. */
export function ProjectFormPill({
  projectId,
  form,
}: {
  projectId: string;
  form: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = asForm(form);

  function choose(f: ProjectForm) {
    setOpen(false);
    if (f === current) return;
    start(async () => {
      await updateProjectForm(projectId, f);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        title="Change what kind of writing this is"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--wc-border-strong)] bg-[var(--wc-paper)] px-2.5 py-0.5 text-[11px] text-[var(--wc-muted)] hover:text-[var(--wc-ink)] hover:border-[var(--wc-slate)] disabled:opacity-50"
      >
        {pending ? "…" : FORM_TERMS[current].label}
        <span aria-hidden className="text-[8px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-40 mt-1 w-44 rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 shadow-[var(--wc-shadow-md)]">
            {PROJECT_FORMS.map((f) => (
              <button
                key={f}
                onClick={() => choose(f)}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs ${
                  f === current
                    ? "bg-[var(--wc-paper)] text-[var(--wc-ink)]"
                    : "text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                }`}
              >
                <span>{FORM_TERMS[f].label}</span>
                <span className="text-[10px] text-[var(--wc-faint)]">{FORM_TERMS[f].hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
