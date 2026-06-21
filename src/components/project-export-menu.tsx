"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXPORT_FORMATS } from "@/lib/manuscript-export";
import { archiveProject } from "@/server/projects";

/** A small export/manage dropdown for a project card on the dashboard. */
export function ProjectExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  function archive() {
    setOpen(false);
    start(async () => {
      await archiveProject(projectId);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={pending}
        className="rounded-[var(--wc-r-sm)] border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2.5 py-1 text-xs text-zinc-600 hover:border-[var(--wc-slate)] hover:text-zinc-900 disabled:opacity-50"
        title="Export or manage this project"
      >
        {pending ? "…" : "⋯"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-60 rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 shadow-[var(--wc-shadow-md)]">
            {EXPORT_FORMATS.map((f) => (
              <Link
                key={f.id}
                href={`/app/export?project=${projectId}&format=${f.id}`}
                download={f.id !== "pdf"}
                target={f.id === "pdf" ? "_blank" : undefined}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-50"
              >
                <span className="text-sm text-zinc-800">{f.label}</span>
                <span className="ml-2 text-[10px] text-zinc-400">{f.note}</span>
              </Link>
            ))}
            <Link
              href="/app/publish"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-lg border-t border-zinc-100 px-2.5 py-1.5 text-xs text-[var(--wc-slate)] hover:bg-zinc-50"
            >
              ✦ Prepare for publication →
            </Link>
            <button
              onClick={archive}
              className="mt-1 block w-full rounded-lg border-t border-zinc-100 px-2.5 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50"
            >
              🗄 Archive project
            </button>
          </div>
        </>
      )}
    </div>
  );
}
