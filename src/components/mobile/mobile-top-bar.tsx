"use client";

import type { ProjectTree } from "@/lib/types";
import { useActiveEditor } from "@/lib/editor-bridge";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { SyncIndicator } from "@/components/mobile/sync-indicator";

/**
 * Top app bar for mobile: the project title and the live sync indicator. There
 * is no hamburger — chapters/structure live on the bottom "Chapters" tab, so the
 * top bar stays minimal. It collapses out of the way when the keyboard is open
 * over an active editor, so the maximum vertical space goes to the writing
 * surface.
 */
export function MobileTopBar({ project }: { project: ProjectTree }) {
  const editor = useActiveEditor();
  const inset = useKeyboardInset();

  // Reclaim vertical space while drafting with the keyboard up.
  if (inset > 0 && editor && !editor.isDestroyed) return null;

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--wc-border)] bg-[var(--wc-surface)]/95 px-4 backdrop-blur md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-12 w-full items-center gap-2">
        <span className="flex-1 truncate font-serif text-base text-[var(--wc-ink)]">
          {project.title}
        </span>
        <SyncIndicator />
      </div>
    </header>
  );
}
