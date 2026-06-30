"use client";

import { useOrganize } from "@/store/organize-store";

/**
 * Bottom tab bar: the primary mobile navigation, replacing the desktop fixed
 * side-nav at phone widths. Brainstorm is the raised center action; Home lives
 * in the top bar instead.
 *
 *   Chapters    -> opens the structure drawer (project tree / scenes)
 *   Story Bible -> openGroup("bible")
 *   Brainstorm  -> setBsOpen(true)  (raised center)
 *   Organize    -> openGroup("organize")  (notes + canvas)
 *   Tags        -> openGroup("tags")
 *
 * Icons are the same emoji the desktop side-nav uses for these tools (see
 * `TOOL_META` in form-config.ts), so phone and web read identically. The bar
 * stays visible while writing; when the keyboard is up it simply sits behind it.
 */
export function MobileTabBar({
  onOpenStructure,
}: {
  onOpenStructure: () => void;
}) {
  const openGroup = useOrganize((s) => s.openGroup);
  const setBsOpen = useOrganize((s) => s.setBsOpen);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--wc-border)] bg-[var(--wc-surface)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1 pb-1">
        <Tab onClick={onOpenStructure} label="Chapters" emoji="📚" />
        <Tab onClick={() => openGroup("bible")} label="Story Bible" emoji="📖" />
        <RaisedTab onClick={() => setBsOpen(true)} label="Brainstorm" emoji="💭" />
        <Tab onClick={() => openGroup("organize")} label="Organize" emoji="🗂️" />
        <Tab onClick={() => openGroup("tags")} label="Tags" emoji="🏷️" />
      </div>
    </nav>
  );
}

function Tab({
  onClick,
  label,
  emoji,
}: {
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-0.5 rounded-lg py-1 text-center text-[10px] leading-tight text-[var(--wc-muted)] active:text-[var(--wc-ink)]"
    >
      <span className="grid h-6 place-items-center text-[17px] leading-none" aria-hidden>
        {emoji}
      </span>
      {label}
    </button>
  );
}

/** Raised center action (Brainstorm), echoing the prominence it had as the FAB. */
function RaisedTab({
  onClick,
  label,
  emoji,
}: {
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <div className="flex w-14 flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="grid h-12 w-12 -translate-y-2 place-items-center rounded-full bg-[var(--wc-slate)] text-[20px] leading-none shadow-[var(--wc-shadow-md)] active:opacity-90"
      >
        <span aria-hidden>{emoji}</span>
      </button>
      <span className="-mt-1 text-[10px] font-medium text-[var(--wc-slate)]">{label}</span>
    </div>
  );
}
