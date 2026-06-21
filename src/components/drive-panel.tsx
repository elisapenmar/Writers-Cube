"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  importDriveDoc,
  exportProjectToDrive,
  disconnectDrive,
  type DriveDoc,
  type DriveStatus,
} from "@/server/drive";

const DRIVE_SCOPES =
  "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";

export function DrivePanel({
  status,
  docs,
  projects,
  driveError = null,
  needsReconnect = false,
}: {
  status: DriveStatus;
  docs: DriveDoc[];
  projects: { id: string; title: string }[];
  driveError?: string | null;
  needsReconnect?: boolean;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(driveError);
  const [workingId, setWorkingId] = useState<string | null>(null);

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

  function importDoc(doc: DriveDoc) {
    setError(null);
    setNote(null);
    setWorkingId(doc.id);
    startBusy(async () => {
      try {
        await importDriveDoc(doc.id);
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

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <header>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
            Google Drive
          </div>
          <h1 className="font-serif text-3xl text-[var(--wc-ink)]">Connect your Drive</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Import Google Docs as projects, and save your manuscripts straight to Drive.
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
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
            <p className="mb-4 text-sm text-zinc-600">
              {status.email
                ? "Your Drive connection needs to be refreshed."
                : "Authorize Writer’s Cube to read your Google Docs and save files to your Drive."}
            </p>
            <button
              onClick={connect}
              className="rounded-2xl px-6 py-3 text-sm text-white shadow"
              style={{ background: "var(--wc-slate)" }}
            >
              {status.email ? "Reconnect Google Drive" : "Connect Google Drive"}
            </button>
          </section>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-sm text-zinc-700">
                Connected{status.email ? ` as ${status.email}` : ""}.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={connect}
                  className="text-xs text-[var(--wc-slate)] hover:underline"
                >
                  Reconnect
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {driveError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-medium">Drive is connected, but the request failed.</div>
                <p className="mt-1 text-amber-800">{driveError}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                  <li>
                    Enable the <b>Google Drive API</b> in your Google Cloud project
                    (APIs &amp; Services → Library → Google Drive API → Enable).
                  </li>
                  <li>
                    On the OAuth consent screen, make sure the Drive scopes are added,
                    then click <b>Reconnect</b> and check the Drive permission boxes.
                  </li>
                </ul>
              </div>
            )}

            {/* Import */}
            <section>
              <h2 className="mb-2 font-serif text-xl text-[var(--wc-ink)]">
                Import a Google Doc
              </h2>
              <p className="mb-3 text-xs text-zinc-500">
                Headings become chapters; the document lands in a new project.
              </p>
              {docs.length === 0 ? (
                <EmptyHint>No Google Docs found in your Drive.</EmptyHint>
              ) : (
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-zinc-800">{d.name}</div>
                        <div className="text-[11px] text-zinc-400">
                          Modified {new Date(d.modifiedTime).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => importDoc(d)}
                        disabled={busy}
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {workingId === d.id ? "Importing…" : "Import"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Export */}
            <section>
              <h2 className="mb-2 font-serif text-xl text-[var(--wc-ink)]">
                Save a project to Drive
              </h2>
              <p className="mb-3 text-xs text-zinc-500">
                Exports a formatted Google Doc using your publication settings.
              </p>
              {projects.length === 0 ? (
                <EmptyHint>You don’t have any projects yet.</EmptyHint>
              ) : (
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                  {projects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="truncate text-sm text-zinc-800">{p.title}</div>
                      <button
                        onClick={() => exportProject(p)}
                        disabled={busy}
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-500">
      {children}
    </p>
  );
}
