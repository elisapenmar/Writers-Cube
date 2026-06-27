"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  openProject,
  createFolder,
  renameFolder,
  deleteFolder,
  type ProjectSummary,
  type ProjectFolder,
} from "@/server/projects";
import { ProjectGoal } from "@/components/project-goal";
import { ProjectExportMenu } from "@/components/project-export-menu";
import { ViewToggle } from "@/components/view-toggle";
import { useViewMode } from "@/store/view-mode-store";

/** Compact "when was this last touched" label for a project. */
function lastTouched(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  const sameYear = then.getFullYear() === new Date().getFullYear();
  return `Edited ${then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

function metaLine(p: ProjectSummary, isActive: boolean): string {
  return (
    `${p.word_count.toLocaleString()} words · ${p.chapter_count} ` +
    `chapter${p.chapter_count === 1 ? "" : "s"}${isActive ? " · open" : ""}`
  );
}

export function ProjectsSection({
  projects,
  folders,
  activeId,
  previewLimit,
}: {
  projects: ProjectSummary[];
  folders: ProjectFolder[];
  activeId: string | null;
  previewLimit: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useViewMode("projects");
  const [folderId, setFolderId] = useState<string | null>(null); // null = All
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const inFolder =
      folderId === null
        ? projects
        : projects.filter((p) => p.folder_id === folderId);
    return [...inFolder].reverse().slice(0, previewLimit);
  }, [projects, folderId, previewLimit]);

  const totalInFolder =
    folderId === null
      ? projects.length
      : projects.filter((p) => p.folder_id === folderId).length;

  const activeFolder = folders.find((f) => f.id === folderId) ?? null;

  function addFolder() {
    const name = window.prompt("Folder name:");
    if (name === null) return;
    start(async () => {
      const { id } = await createFolder(name || "New folder");
      setFolderId(id);
      router.refresh();
    });
  }
  function rename() {
    if (!activeFolder) return;
    const name = window.prompt("Rename folder:", activeFolder.name);
    if (name === null) return;
    start(async () => {
      await renameFolder(activeFolder.id, name);
      router.refresh();
    });
  }
  function remove() {
    if (!activeFolder) return;
    if (!window.confirm(`Delete the folder "${activeFolder.name}"? Its projects move back to All.`))
      return;
    start(async () => {
      await deleteFolder(activeFolder.id);
      setFolderId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="flex items-center gap-2.5 font-serif text-2xl sm:text-[1.7rem] tracking-tight text-[var(--wc-ink)]">
          <span className="wc-facet" aria-hidden />
          Your projects
        </h2>
        <div className="flex items-center gap-3">
          <ViewToggle mode={mode} onChange={setMode} />
          {totalInFolder > previewLimit && (
            <Link href="/app/projects" className="text-xs text-[var(--wc-slate)] hover:underline">
              View all
            </Link>
          )}
          <Link
            href="/app/archive"
            className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:underline"
          >
            🗄 Archive
          </Link>
        </div>
      </div>

      {/* Folder bar — between the section title and the cards */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FolderChip active={folderId === null} onClick={() => setFolderId(null)}>
          All
        </FolderChip>
        {folders.map((f) => (
          <FolderChip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)}>
            {f.name}
          </FolderChip>
        ))}
        <button
          onClick={addFolder}
          disabled={pending}
          className="rounded-full border border-dashed border-[var(--wc-border-strong)] px-2.5 py-1 text-xs text-[var(--wc-muted)] hover:text-[var(--wc-ink)] hover:border-[var(--wc-slate)] disabled:opacity-50"
          title="Create a folder"
        >
          ＋ Folder
        </button>
        {activeFolder && (
          <span className="ml-1 flex items-center gap-1">
            <button
              onClick={rename}
              className="rounded px-1 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
              title="Rename this folder"
            >
              ✏
            </button>
            <button
              onClick={remove}
              className="rounded px-1 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
              title="Delete this folder"
            >
              🗑
            </button>
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--wc-r-lg)] border border-dashed border-[var(--wc-border-strong)] px-4 py-6 text-center text-sm text-[var(--wc-faint)]">
          {folderId === null
            ? "No projects yet."
            : "No projects in this folder yet — move one here from its ⋯ menu."}
        </p>
      ) : mode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((p) => (
            <div key={p.id} data-active={activeId === p.id} className="wc-card relative p-4">
              <form action={openProject}>
                <input type="hidden" name="projectId" value={p.id} />
                <button type="submit" className="block w-full text-left pr-16">
                  <div className="font-serif text-lg text-[var(--wc-ink)]">{p.title}</div>
                  <div className="text-xs text-[var(--wc-faint)] mt-1">
                    {metaLine(p, activeId === p.id)}
                  </div>
                </button>
              </form>
              <ProjectGoal projectId={p.id} wordCount={p.word_count} initialGoal={p.word_goal} />
              <div className="absolute top-3 right-3">
                <ProjectExportMenu
                  projectId={p.id}
                  folders={folders}
                  currentFolderId={p.folder_id}
                />
              </div>
              <div className="absolute bottom-4 right-4 text-[10px] text-[var(--wc-faint)] pointer-events-none">
                {lastTouched(p.updated_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--wc-border)] rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)]">
          {visible.map((p) => (
            <li key={p.id} data-active={activeId === p.id} className="flex items-center gap-3 px-3 py-2">
              <form action={openProject} className="min-w-0 flex-1">
                <input type="hidden" name="projectId" value={p.id} />
                <button type="submit" className="block w-full truncate text-left">
                  <span className="font-serif text-[var(--wc-ink)]">{p.title}</span>
                  <span className="ml-2 text-xs text-[var(--wc-faint)]">
                    {metaLine(p, activeId === p.id)}
                  </span>
                </button>
              </form>
              <span className="hidden sm:block shrink-0 text-[10px] text-[var(--wc-faint)]">
                {lastTouched(p.updated_at)}
              </span>
              <div className="shrink-0">
                <ProjectExportMenu
                  projectId={p.id}
                  folders={folders}
                  currentFolderId={p.folder_id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FolderChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition ${
        active
          ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
          : "border border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:text-[var(--wc-ink)] hover:border-[var(--wc-slate)]"
      }`}
    >
      {children}
    </button>
  );
}
