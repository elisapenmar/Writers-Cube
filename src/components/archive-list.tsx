"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveProject, deleteProjectForever } from "@/server/projects";

type ArchivedProject = {
  id: string;
  title: string;
  words: number;
  chapters: number;
  archivedAt: string | null;
};

export function ArchiveList({ projects }: { projects: ArchivedProject[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function restore(id: string) {
    setError(null);
    setWorkingId(id);
    start(async () => {
      try {
        await unarchiveProject(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Restore failed");
      } finally {
        setWorkingId(null);
      }
    });
  }

  function deleteForever(id: string) {
    setError(null);
    setWorkingId(id);
    start(async () => {
      try {
        await deleteProjectForever(id);
        setConfirmId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setWorkingId(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-base text-[var(--wc-ink)]">{p.title}</div>
              <div className="text-[11px] text-zinc-400">
                {p.words.toLocaleString()} words · {p.chapters} chapter
                {p.chapters === 1 ? "" : "s"}
                {p.archivedAt && ` · archived ${new Date(p.archivedAt).toLocaleDateString()}`}
              </div>
            </div>

            {confirmId === p.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700">Delete forever?</span>
                <button
                  onClick={() => deleteForever(p.id)}
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {workingId === p.id ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => restore(p.id)}
                  disabled={pending}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {workingId === p.id ? "…" : "Restore"}
                </button>
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
