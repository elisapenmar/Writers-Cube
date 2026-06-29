"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  openProject,
  createProjectAndOpen,
  createFolder,
  renameFolder,
  deleteFolder,
  moveProjectToFolder,
  type ProjectSummary,
  type ProjectFolder,
} from "@/server/projects";
import { ProjectExportMenu } from "@/components/project-export-menu";
import { OpenPending } from "@/components/open-pending";

/** Full project browser for the "View all" page: folder management + filtering
 *  + the grid of projects. (Folder creation lives here, not on the dashboard.) */
export function ProjectsBrowser({
  projects,
  folders,
  activeId,
}: {
  projects: ProjectSummary[];
  folders: ProjectFolder[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null | "none">("none");

  function moveTo(targetFolderId: string | null, projectId: string) {
    setDragId(null);
    setDropTarget("none");
    start(async () => {
      await moveProjectToFolder(projectId, targetFolderId);
      router.refresh();
    });
  }
  function onChipDrop(targetFolderId: string | null, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) moveTo(targetFolderId, id);
  }

  const visible = useMemo(
    () =>
      folderId === null
        ? [...projects].reverse()
        : projects.filter((p) => p.folder_id === folderId).reverse(),
    [projects, folderId],
  );
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
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          active={folderId === null}
          onClick={() => setFolderId(null)}
          dropActive={dragId !== null && dropTarget === "all"}
          onDragOver={dragId ? (e) => { e.preventDefault(); setDropTarget("all"); } : undefined}
          onDragLeave={dragId ? () => setDropTarget("none") : undefined}
          onDrop={dragId ? (e) => onChipDrop(null, e) : undefined}
        >
          All
        </Chip>
        {folders.map((f) => (
          <Chip
            key={f.id}
            active={folderId === f.id}
            onClick={() => setFolderId(f.id)}
            dropActive={dragId !== null && dropTarget === f.id}
            onDragOver={dragId ? (e) => { e.preventDefault(); setDropTarget(f.id); } : undefined}
            onDragLeave={dragId ? () => setDropTarget("none") : undefined}
            onDrop={dragId ? (e) => onChipDrop(f.id, e) : undefined}
          >
            {f.name}
          </Chip>
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
            <button onClick={rename} className="rounded px-1 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]" title="Rename this folder">
              ✏
            </button>
            <button onClick={remove} className="rounded px-1 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]" title="Delete this folder">
              🗑
            </button>
          </span>
        )}
      </div>

      {folders.length > 0 && (
        <p className="text-xs text-[var(--wc-faint)]">
          Tip: drag a project onto a folder above to file it (or use the ⋯ menu).
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
              setDragId(p.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropTarget("none");
            }}
            className={`wc-card relative p-4 cursor-grab active:cursor-grabbing ${dragId === p.id ? "opacity-50" : ""}`}
            data-active={activeId === p.id}
          >
            <form action={openProject}>
              <input type="hidden" name="projectId" value={p.id} />
              <button type="submit" className="block w-full text-left pr-10">
                <div className="font-serif text-lg text-[var(--wc-ink)]">{p.title}</div>
                <div className="text-xs text-[var(--wc-faint)] mt-1">
                  {p.word_count.toLocaleString()} words · {p.chapter_count}{" "}
                  chapter{p.chapter_count === 1 ? "" : "s"}
                  {p.id === activeId && " · open"}
                </div>
              </button>
              <OpenPending />
            </form>
            <div className="absolute top-3 right-3">
              <ProjectExportMenu projectId={p.id} folders={folders} currentFolderId={p.folder_id} />
            </div>
          </div>
        ))}

        <form
          action={createProjectAndOpen}
          className="rounded-2xl p-4 border border-dashed border-[var(--wc-border-strong)] bg-transparent flex items-center justify-center"
        >
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--wc-on-accent)]"
            style={{ background: "var(--wc-slate)" }}
          >
            ＋ New project
          </button>
        </form>
      </div>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
  dropActive = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dropActive?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-full px-3 py-1 text-xs transition ${
        dropActive
          ? "ring-2 ring-[var(--wc-slate)] ring-offset-1 bg-[var(--wc-canvas)] text-[var(--wc-ink)]"
          : active
            ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
            : "border border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:text-[var(--wc-ink)] hover:border-[var(--wc-slate)]"
      }`}
    >
      {children}
    </button>
  );
}
