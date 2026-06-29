"use client";

import type { ProjectTree } from "@/lib/types";
import { useActiveEditor } from "@/lib/editor-bridge";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { SyncIndicator } from "@/components/mobile/sync-indicator";

/**
 * Top app bar for mobile: a hamburger that opens the structure drawer, the
 * project title, and the live sync indicator. It collapses out of the way when
 * the keyboard is open over an active editor, so the maximum vertical space goes
 * to the writing surface (the editor's own back/header chrome stays in place).
 */
export function MobileTopBar({
  project,
  onOpenStructure,
}: {
  project: ProjectTree;
  onOpenStructure: () => void;
}) {
  const editor = useActiveEditor();
  const inset = useKeyboardInset();

  // Reclaim vertical space while drafting with the keyboard up.
  if (inset > 0 && editor && !editor.isDestroyed) return null;

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--wc-border)] bg-[var(--wc-surface)]/95 px-2 backdrop-blur md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-12 w-full items-center gap-2">
        <button
          type="button"
          onClick={onOpenStructure}
          aria-label="Open chapters"
          className="grid h-10 w-10 place-items-center rounded-lg text-[var(--wc-ink)] active:bg-[var(--wc-paper)]"
        >
          <MenuIcon />
        </button>
        <span className="flex-1 truncate font-serif text-base text-[var(--wc-ink)]">
          {project.title}
        </span>
        <SyncIndicator />
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
