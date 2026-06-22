"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  browseDrive,
  importDriveFile,
  exportProjectToDrive,
  disconnectDrive,
  type DriveEntry,
  type DriveStatus,
} from "@/server/drive";

const DRIVE_SCOPES =
  "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";

type Crumb = { id: string; name: string };

export function DrivePanel({
  status,
  entries,
  projects,
  driveError = null,
}: {
  status: DriveStatus;
  entries: DriveEntry[];
  projects: { id: string; title: string }[];
  driveError?: string | null;
  needsReconnect?: boolean;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(driveError);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // File-browser state.
  const [items, setItems] = useState<DriveEntry[]>(entries);
  const [path, setPath] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  async function connect() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?drive=1&next=/app/drive`,
        scopes: DRIVE_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setError(error.message);
  }

  function disconnect() {
    startBusy(async () => {
      await disconnectDrive();
      router.refresh();
    });
  }

  async function openFolder(folder: DriveEntry, fromCrumbIndex?: number) {
    setError(null);
    setLoadingFolder(true);
    try {
      const next = await browseDrive(folder.id);
      setItems(next);
      if (fromCrumbIndex != null) {
        setPath((p) => p.slice(0, fromCrumbIndex + 1));
      } else {
        setPath((p) => [...p, { id: folder.id, name: folder.name }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open folder");
    } finally {
      setLoadingFolder(false);
    }
  }

  function navigateCrumb(index: number) {
    const crumb = path[index];
    if (index === path.length - 1) return;
    void openFolder({ id: crumb.id, name: crumb.name } as DriveEntry, index);
  }

  function importEntry(entry: DriveEntry) {
    setError(null);
    setNote(null);
    setWorkingId(entry.id);
    startBusy(async () => {
      try {
        await importDriveFile(entry.id, entry.mimeType);
        router.push("/app/manuscript");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setWorkingId(null);
      }
    });
  }

  function exportProject(p: { id: string; title: string }) {
    setError(null);
    setNote(null);
    setWorkingId(p.id);
    startBusy(async () => {
      try {
        const { name } = await exportProjectToDrive(p.id);
        setNote(`“${name}” was saved to your Google Drive as a Google Doc.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setWorkingId(null);
      }
    });
  }

  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <header>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
            Google Drive
          </div>
          <h1 className="font-serif text-3xl text-[var(--wc-ink)]">Connect your Drive</h1>
          <p className="mt-1 text-sm text-[var(--wc-muted)]">
            Browse your Drive, import documents as projects, and save manuscripts back to Drive.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {note && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {note}
          </div>
        )}

        {!status.connected ? (
          <section className="rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6 text-center">
            <p className="mb-4 text-sm text-[var(--wc-muted)]">
              {status.email
                ? "Your Drive connection needs to be refreshed."
                : "Authorize Writer’s Cube to read your Google Docs and save files to your Drive."}
            </p>
            <button
              onClick={connect}
              className="rounded-2xl px-6 py-3 text-sm text-[var(--wc-on-accent)] shadow"
              style={{ background: "var(--wc-slate)" }}
            >
              {status.email ? "Reconnect Google Drive" : "Connect Google Drive"}
            </button>
          </section>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-3">
              <div className="text-sm text-[var(--wc-muted)]">
                Connected{status.email ? ` as ${status.email}` : ""}.
              </div>
              <div className="flex items-center gap-3">
                <button onClick={connect} className="text-xs text-[var(--wc-slate)] hover:underline">
                  Reconnect
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {driveError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-medium">Drive is connected, but the request failed.</div>
                <p className="mt-1 text-amber-800">{driveError}</p>
              </div>
            )}

            {/* File browser */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-serif text-xl text-[var(--wc-ink)]">Your Drive</h2>
                {loadingFolder && <span className="text-xs text-[var(--wc-faint)]">Loading…</span>}
              </div>

              {/* Breadcrumb */}
              <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[var(--wc-faint)]">
                {path.map((c, i) => (
                  <span key={`${c.id}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[var(--wc-faint)]">/</span>}
                    <button
                      onClick={() => navigateCrumb(i)}
                      className={
                        i === path.length - 1
                          ? "font-medium text-[var(--wc-muted)]"
                          : "text-[var(--wc-slate)] hover:underline"
                      }
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </div>

              <div className="divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)]">
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-[var(--wc-faint)]">
                    This folder is empty.
                  </div>
                ) : (
                  <>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => openFolder(f)}
                        disabled={loadingFolder}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--wc-canvas)] disabled:opacity-50"
                      >
                        <span>📁</span>
                        <span className="flex-1 truncate text-sm text-[var(--wc-ink)]">{f.name}</span>
                        <span className="text-[var(--wc-faint)]">›</span>
                      </button>
                    ))}
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 px-4 py-2.5">
                        <span>{iconFor(f.mimeType)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[var(--wc-ink)]">{f.name}</div>
                          {f.modifiedTime && (
                            <div className="text-[11px] text-[var(--wc-faint)]">
                              Modified {new Date(f.modifiedTime).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {f.importable ? (
                          <button
                            onClick={() => importEntry(f)}
                            disabled={busy}
                            className="shrink-0 rounded-lg border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-50"
                          >
                            {workingId === f.id ? "Importing…" : "Import"}
                          </button>
                        ) : (
                          <span className="shrink-0 text-[11px] text-[var(--wc-faint)]">—</span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--wc-faint)]">
                Importable: Google Docs, Word (.docx), and text files. Headings become chapters.
              </p>
            </section>

            {/* Export */}
            <section>
              <h2 className="mb-2 font-serif text-xl text-[var(--wc-ink)]">
                Save a project to Drive
              </h2>
              <p className="mb-3 text-xs text-[var(--wc-faint)]">
                Exports a formatted Google Doc using your publication settings.
              </p>
              {projects.length === 0 ? (
                <EmptyHint>You don’t have any projects yet.</EmptyHint>
              ) : (
                <div className="divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)]">
                  {projects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="truncate text-sm text-[var(--wc-ink)]">{p.title}</div>
                      <button
                        onClick={() => exportProject(p)}
                        disabled={busy}
                        className="shrink-0 rounded-lg border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-50"
                      >
                        {workingId === p.id ? "Saving…" : "Save to Drive"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function iconFor(mime: string): string {
  if (mime === "application/vnd.google-apps.document") return "📄";
  if (mime.includes("wordprocessingml") || mime.includes("rtf")) return "📝";
  if (mime.startsWith("text/")) return "📃";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📕";
  if (mime.startsWith("application/vnd.google-apps")) return "🟢";
  return "📎";
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--wc-border-strong)] px-4 py-5 text-sm text-[var(--wc-faint)]">
      {children}
    </p>
  );
}
