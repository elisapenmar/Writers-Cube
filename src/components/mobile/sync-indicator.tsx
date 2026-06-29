"use client";

import { useSyncStatus, type SyncStatus } from "@/lib/sync-state";

const META: Record<SyncStatus, { label: string; dot: string; text: string }> = {
  synced: { label: "Synced", dot: "var(--wc-sage)", text: "var(--wc-faint)" },
  pending: { label: "Saving", dot: "var(--wc-ochre)", text: "var(--wc-muted)" },
  offline: { label: "Offline", dot: "var(--wc-clay)", text: "var(--wc-muted)" },
};

/**
 * Compact sync-state pill (synced / saving / offline) for the mobile chrome.
 * Reads the shared `useSyncStatus` store, so it reflects Agent A's engine once
 * wired and the connectivity fallback until then. `bare` drops the background
 * for placement inside another chrome bar.
 */
export function SyncIndicator({ bare = false }: { bare?: boolean }) {
  const status = useSyncStatus();
  const m = META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] leading-none ${
        bare ? "" : "rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1"
      }`}
      style={{ color: m.text }}
      title={`Your work is ${m.label.toLowerCase()}`}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${status === "pending" ? "animate-pulse" : ""}`}
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}
