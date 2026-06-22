"use client";

import { useState } from "react";
import Link from "next/link";
import { importManuscript } from "@/server/import";

type View = "menu" | "computer";

/** Compact import control — a dropdown to import from the computer or Google. */
export function ImportButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  function close() {
    setOpen(false);
    setView("menu");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setView("menu");
        }}
        className="rounded-[var(--wc-r-lg)] border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-4 py-2.5 text-sm text-[var(--wc-ink)] transition hover:border-[var(--wc-slate)]"
        title="Import a manuscript as a new project"
      >
        ↑ Import ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          {view === "menu" ? (
            <div className="absolute right-0 z-30 mt-2 w-60 rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 shadow-[var(--wc-shadow-md)]">
              <button
                onClick={() => setView("computer")}
                className="flex w-full items-center gap-2 rounded-[var(--wc-r-md)] px-3 py-2 text-left text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
              >
                <span aria-hidden>💻</span>
                <span>
                  <span className="block">From computer</span>
                  <span className="block text-[11px] text-[var(--wc-faint)]">.docx, .md, or .txt</span>
                </span>
              </button>
              <Link
                href="/app/drive"
                onClick={close}
                className="flex w-full items-center gap-2 rounded-[var(--wc-r-md)] px-3 py-2 text-left text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
              >
                <span aria-hidden>☁</span>
                <span>
                  <span className="block">From Google Drive</span>
                  <span className="block text-[11px] text-[var(--wc-faint)]">Pick a Doc or file</span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="absolute right-0 z-30 mt-2 w-80 rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 shadow-[var(--wc-shadow-md)]">
              <button
                onClick={() => setView("menu")}
                className="mb-2 text-[11px] text-[var(--wc-muted)] hover:text-[var(--wc-ink)]"
              >
                ‹ Back
              </button>
              <div className="font-serif text-base text-[var(--wc-ink)]">Import from your computer</div>
              <p className="mt-1 mb-3 text-xs text-[var(--wc-muted)]">
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
                  className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--wc-paper)] file:px-3 file:py-1.5 file:text-[var(--wc-muted)] hover:file:bg-[var(--wc-stone)]"
                />
                <button
                  type="submit"
                  className="self-start rounded-[var(--wc-r-md)] px-4 py-2 text-sm text-[var(--wc-on-accent)] transition hover:brightness-105"
                  style={{ background: "var(--wc-slate)" }}
                >
                  Import to a new project
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
