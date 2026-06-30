"use client";

import Link from "next/link";
import type { ProjectTree } from "@/lib/types";
import { SyncIndicator } from "@/components/mobile/sync-indicator";
import { CubeMark } from "@/components/icons";

/**
 * Top app bar for mobile: a Home button (the Writer's Cube mark, same as the web
 * app's home affordance) on the left before the project title, then the live
 * sync indicator. Structure/chapters live on the bottom "Chapters" tab, so there
 * is no hamburger. The shell makes this sticky (together with the editor
 * formatting bar) so it stays put while writing.
 */
export function MobileTopBar({ project }: { project: ProjectTree }) {
  return (
    <header
      className="flex items-center gap-2 border-b border-[var(--wc-border)] bg-[var(--wc-surface)]/95 px-3 backdrop-blur md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-12 w-full items-center gap-2">
        <Link
          href="/app"
          aria-label="Home"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--wc-slate)] active:bg-[var(--wc-paper)]"
        >
          <CubeMark size={22} />
        </Link>
        <span className="flex-1 truncate font-serif text-base text-[var(--wc-ink)]">
          {project.title}
        </span>
        <SyncIndicator />
      </div>
    </header>
  );
}
