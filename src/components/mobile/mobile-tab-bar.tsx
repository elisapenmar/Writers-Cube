"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveEditor } from "@/lib/editor-bridge";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { MobileQuickCapture } from "@/components/mobile/mobile-quick-capture";

/**
 * Bottom tab bar: the primary mobile navigation, replacing the desktop fixed
 * side-nav at phone widths. Five thumb-reachable targets with the "Scene" action
 * raised in the center.
 *
 *   Home      -> dashboard
 *   Chapters  -> opens the structure drawer (project tree / scenes)
 *   Scene     -> one-tap new (loose/uncategorized) scene for this project (center)
 *   Tools     -> opens the Story Bible / AI panels (organize panel)
 *   More      -> opens the nav drawer's secondary menu (settings, sign out)
 *
 * It hides itself whenever the on-screen keyboard is open AND an editor is
 * focused, so it never competes with the editor formatting bar for the bottom
 * of the screen.
 */
export function MobileTabBar({
  projectId,
  onOpenStructure,
  onOpenTools,
  onOpenMore,
}: {
  projectId: string;
  onOpenStructure: () => void;
  onOpenTools: () => void;
  onOpenMore: () => void;
}) {
  const pathname = usePathname();
  const editor = useActiveEditor();
  const inset = useKeyboardInset();

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
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5 pb-1">
        <TabLink href="/app" active={home} label="Home" icon={<HomeIcon />} />
        <TabButton onClick={onOpenStructure} label="Chapters" icon={<ListIcon />} />
        <MobileQuickCapture projectId={projectId} variant="fab" />
        <TabButton onClick={onOpenTools} label="Tools" icon={<SparkIcon />} />
        <TabButton onClick={onOpenMore} label="More" icon={<MoreIcon />} />
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
      className={`flex w-14 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] ${
        active ? "text-[var(--wc-slate)]" : "text-[var(--wc-faint)]"
      }`}
    >
      <span className="h-6 grid place-items-center">{icon}</span>
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
      className="flex w-14 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] text-[var(--wc-faint)] active:text-[var(--wc-slate)]"
    >
      <span className="h-6 grid place-items-center">{icon}</span>
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
function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
