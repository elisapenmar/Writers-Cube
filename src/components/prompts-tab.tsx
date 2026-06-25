"use client";

import { useEffect, useState } from "react";
import { listProjects, getActiveProjectId } from "@/server/projects";
import { PromptTool } from "@/components/prompt-tool";

/** Prompts inside the right-side panel, defaults to a prompt grounded in the
 *  current project, so the writer can work the prompt next to their manuscript. */
export function PromptsTab() {
  const [data, setData] = useState<{
    projects: { id: string; title: string }[];
    activeProjectId: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listProjects(), getActiveProjectId()])
      .then(([projects, activeProjectId]) => {
        if (alive)
          setData({
            projects: projects.map((p) => ({ id: p.id, title: p.title })),
            activeProjectId,
          });
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className="p-4 text-xs text-red-600">{error}</p>;
  if (!data) return <p className="p-4 text-xs text-[var(--wc-faint)]">Loading prompts…</p>;

  return (
    <div className="flex-1 overflow-y-auto">
      <PromptTool
        projects={data.projects}
        activeProjectId={data.activeProjectId}
        defaultMode="existing"
      />
    </div>
  );
}
