"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveEditor } from "@/lib/editor-bridge";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useOrganize } from "@/store/organize-store";

/**
 * Bottom tab bar: the primary mobile navigation, replacing the desktop fixed
 * side-nav at phone widths. Five thumb-reachable targets with Home in the center:
 *
 *   Chapters    -> opens the structure drawer (project tree / scenes)
 *   Story Bible -> opens the Story Bible panel (openGroup "bible")
 *   Home        -> dashboard (center)
 *   Organize    -> opens the Organize panel: notes + canvas (openGroup "organize")
 *   Tags        -> opens the Tags panel (openGroup "tags")
 *
 * Story Bible / Organize / Tags drive the shared organize store, which the
 * `OrganizePanel` mounted in the shell renders full-screen on phones.
 *
 * It hides itself whenever the on-screen keyboard is open AND an editor is
 * focused, so it never competes with the editor formatting bar for the bottom
 * of the screen.
 */
export function MobileTabBar({
  onOpenStructure,
}: {
  onOpenStructure: () => void;
}) {
  const pathname = usePathname();
  const editor = useActiveEditor();
  const inset = useKeyboardInset();
  const openGroup = useOrganize((s) => s.openGroup);

  // When the keyboard is up over an active editor, the formatting bar owns the
  // bottom edge; suppress the tab bar to avoid stacking two bars.
  if (inset > 0 && editor && !editor.isDestroyed) return null;

  const home = pathname === "/app";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--wc-border)] bg-[var(--wc-surface)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-start justify-around px-2 pt-1.5 pb-1">
        <TabButton onClick={onOpenStructure} label="Chapters" icon={<ListIcon />} />
        <TabButton onClick={() => openGroup("bible")} label="Story Bible" icon={<BookIcon />} />
        <TabLink href="/app" active={home} label="Home" icon={<HomeIcon />} />
        <TabButton onClick={() => openGroup("organize")} label="Organize" icon={<OrganizeIcon />} />
        <TabButton onClick={() => openGroup("tags")} label="Tags" icon={<TagIcon />} />
      </div>
    </nav>
  );
}

function TabLink({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex w-14 flex-col items-center gap-0.5 rounded-lg py-1 text-center text-[10px] leading-tight ${
        active ? "text-[var(--wc-slate)]" : "text-[var(--wc-faint)]"
      }`}
    >
      <span className="grid h-6 place-items-center">{icon}</span>
      {label}
    </Link>
  );
}

function TabButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-0.5 rounded-lg py-1 text-center text-[10px] leading-tight text-[var(--wc-faint)] active:text-[var(--wc-slate)]"
    >
      <span className="grid h-6 place-items-center">{icon}</span>
      {label}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </svg>
  );
}
function OrganizeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.1 6.1a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 11.5Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
