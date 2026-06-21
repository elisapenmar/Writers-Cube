"use client";

import { useState } from "react";
import Link from "next/link";
import { EXPORT_FORMATS } from "@/lib/manuscript-export";

/** A small export dropdown for a project card on the dashboard. */
export function ProjectExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
        title="Export this project"
      >
        Export ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-60 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
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
          </div>
        </>
      )}
    </div>
  );
}
