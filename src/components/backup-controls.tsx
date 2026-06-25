"use client";

import { useEffect, useState } from "react";
import { autoBackupIfStale, backupToDrive } from "@/server/backup";

/**
 * Durability controls: a "download a full backup" link, a manual "back up to
 * Drive" button, and a fire-and-forget daily off-site backup on visit.
 */
export function BackupControls() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Daily off-site backup whenever the user is active (no-op if Drive isn't
  // connected or a backup ran in the last 24h).
  useEffect(() => {
    void autoBackupIfStale().catch(() => {});
  }, []);

  async function toDrive() {
    setBusy(true);
    setNote(null);
    try {
      const r = await backupToDrive();
      setNote(
        r.ok
          ? "Backed up to your Google Drive."
          : r.reason === "drive-not-connected"
          ? "Connect Google Drive first to back up there."
          : "Couldn't back up to Drive, try reconnecting Drive.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <a
        href="/app/backup"
        className="rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] px-3 py-1.5 text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        title="Download your entire account as a JSON file you keep"
      >
        ⤓ Download a full backup
      </a>
      <button
        onClick={toDrive}
        disabled={busy}
        className="rounded-[var(--wc-r-md)] border border-[var(--wc-border-strong)] px-3 py-1.5 text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-50"
        title="Save a full backup to your Google Drive now"
      >
        {busy ? "Backing up…" : "☁ Back up to Drive now"}
      </button>
      {note && <span className="text-[var(--wc-muted)]">{note}</span>}
    </div>
  );
}
