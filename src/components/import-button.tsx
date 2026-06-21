"use client";

import { useState } from "react";
import { importManuscript } from "@/server/import";

/** Compact import control — a button that reveals a small upload panel. */
export function ImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-[var(--wc-ink)] hover:border-zinc-400"
        title="Import a .docx, .md, or .txt as a new project"
      >
        ↑ Import
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="font-serif text-base text-[var(--wc-ink)]">Import a manuscript</div>
            <p className="mt-1 mb-3 text-xs text-zinc-500">
              Upload a <b>.docx</b>, <b>.md</b>, or <b>.txt</b>. Headings become chapters;{" "}
              <span className="font-mono">* * *</span> or <span className="font-mono">#</span> split
              scenes. It lands in a new project.
            </p>
            <form action={importManuscript} className="flex flex-col gap-2">
              <input
                type="file"
                name="file"
                accept=".docx,.md,.markdown,.txt"
                required
                className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-zinc-700 hover:file:bg-zinc-200"
              />
              <button
                type="submit"
                className="self-start rounded-xl px-4 py-2 text-sm text-white"
                style={{ background: "var(--wc-slate)" }}
              >
                Import to a new project
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
