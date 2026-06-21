"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveExercise } from "@/server/prompts";

export function MoveExerciseControl({
  exerciseId,
  currentProjectId,
  projects,
}: {
  exerciseId: string;
  currentProjectId: string | null;
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(projectId: string | null) {
    setError(null);
    start(async () => {
      try {
        const { looseId } = await moveExercise(exerciseId, projectId);
        if (looseId) {
          // It became a project page — open it there.
          router.push(`/app/loose/${looseId}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Move failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-zinc-500">Belongs to:</label>
      <select
        value={currentProjectId ?? ""}
        disabled={pending}
        onChange={(e) => move(e.target.value === "" ? null : e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none disabled:opacity-50"
      >
        <option value="">Practice library (no project)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-zinc-400">Moving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
