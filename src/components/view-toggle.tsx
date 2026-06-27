"use client";

import type { ViewMode } from "@/store/view-mode-store";

/** Card / list segmented toggle, used to switch how a section's items render. */
export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--wc-border-strong)] overflow-hidden">
      <ToggleBtn active={mode === "card"} onClick={() => onChange("card")} title="Card view">
        <CardIcon />
      </ToggleBtn>
      <ToggleBtn active={mode === "list"} onClick={() => onChange("list")} title="List view">
        <ListIcon />
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`grid h-7 w-8 place-items-center ${
        active
          ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
          : "text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
      }`}
    >
      {children}
    </button>
  );
}

function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  );
}
