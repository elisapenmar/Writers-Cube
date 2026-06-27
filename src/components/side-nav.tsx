"use client";

import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chapter, ProjectTree, Scene } from "@/lib/types";
import {
  createChapter,
  createScene,
  createPieceInProject,
  renameChapter,
  renameScene,
  reorderChapters,
  reorderScenes,
  updateProjectMetadata,
  attachUncategorizedToChapter,
  signOut,
} from "@/server/scenes";
import { termsFor } from "@/lib/project-forms";
import { EditableTitle } from "@/components/editable-title";
import { ProjectFormPill } from "@/components/project-form-pill";
import { createLooseScene } from "@/server/loose";
import { useOrganize } from "@/store/organize-store";
import { useEditorView } from "@/store/editor-view-store";
import { SidebarToggle, CubeMark } from "@/components/icons";

export type UncategorizedItem = {
  id: string;
  kind: "loose" | "exercise";
  title: string;
};

export function SideNav({
  project,
  uncategorized = [],
}: {
  project: ProjectTree;
  uncategorized?: UncategorizedItem[];
}) {
  const router = useRouter();
  const params = useParams<{ sceneId?: string }>();
  const [chapters, setChapters] = useState<Chapter[]>(project.chapters);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [dragItem, setDragItem] = useState<{ id: string; kind: "loose" | "exercise" } | null>(null);
  const [overChapter, setOverChapter] = useState<string | null>(null);

  function dropOnChapter(chapterId: string) {
    const item = dragItem;
    setDragItem(null);
    setOverChapter(null);
    if (!item) return;
    startTransition(async () => {
      const { sceneId } = await attachUncategorizedToChapter(item.id, item.kind, chapterId);
      router.push(`/app/scene/${sceneId}`);
      router.refresh();
    });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setChapters(project.chapters);
  }, [project.chapters]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addChapter() {
    startTransition(async () => {
      await createChapter(project.id);
    });
  }

  function addScene(chapterId: string) {
    startTransition(async () => {
      const sceneId = await createScene(chapterId);
      router.push(`/app/scene/${sceneId}`);
    });
  }

  function addPiece() {
    startTransition(async () => {
      const sceneId = await createPieceInProject(project.id);
      router.push(`/app/scene/${sceneId}`);
    });
  }

  const terms = termsFor(project.form);

  function onChapterDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(chapters, oldIndex, newIndex);
    setChapters(next);
    startTransition(async () => {
      await reorderChapters(project.id, next.map((c) => c.id));
    });
  }

  function onScenesDragEnd(chapterId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const oldIndex = chapter.scenes.findIndex((s) => s.id === active.id);
    const newIndex = chapter.scenes.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextScenes = arrayMove(chapter.scenes, oldIndex, newIndex);
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, scenes: nextScenes } : c)),
    );
    startTransition(async () => {
      await reorderScenes(chapterId, nextScenes.map((s) => s.id));
    });
  }

  const navCollapsed = useOrganize((s) => s.navCollapsed);
  const toggleNavCollapsed = useOrganize((s) => s.toggleNavCollapsed);

  if (navCollapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-[var(--wc-border)] bg-[var(--wc-surface)] flex flex-col min-h-screen items-center py-3 gap-3">
        <button
          onClick={toggleNavCollapsed}
          className="sticky top-3 z-10 w-8 h-8 rounded-lg bg-[var(--wc-surface)] text-[var(--wc-faint)] hover:bg-[var(--wc-paper)] grid place-items-center"
          title="Expand side nav"
        >
          <SidebarToggle collapsed />
        </button>
        <div className="text-[10px] text-[var(--wc-faint)] [writing-mode:vertical-rl] rotate-180 font-serif tracking-wider">
          {project.title}
        </div>
      </aside>
    );
  }

  const firstSceneId = chapters[0]?.scenes[0]?.id;

  return (
    <aside className="w-72 shrink-0 border-r border-[var(--wc-border)] bg-[var(--wc-surface)] flex flex-col h-screen">
      {/* Header: dashboard + project identity */}
      <div className="px-3 pt-2.5 pb-3 border-b border-[var(--wc-border)]">
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] rounded-lg px-1.5 py-1 hover:bg-[var(--wc-paper)]"
            title="Back to dashboard"
          >
            <CubeMark className="text-[var(--wc-slate)]" /> Dashboard
          </Link>
          <button
            onClick={toggleNavCollapsed}
            className="w-7 h-7 rounded-lg text-[var(--wc-faint)] hover:bg-[var(--wc-paper)] hover:text-[var(--wc-ink)] grid place-items-center"
            title="Collapse side nav"
          >
            <SidebarToggle />
          </button>
        </div>
        <div className="mt-2 px-1">
          <ProjectMetadata project={project} />
        </div>
      </div>

      {/* Tools */}
      <div className="px-3 py-2 border-b border-[var(--wc-border)]">
        <ToolsRow />
      </div>

      {/* Structure header + view toggle */}
      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">
          {terms.flatHeader}
        </span>
        <SceneScrollToggle
          firstSceneId={firstSceneId}
          projectId={project.id}
          form={project.form}
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {terms.flat ? (
          <FlatPieces
            chapters={chapters}
            activeSceneId={params.sceneId}
            sensors={sensors}
            mounted={mounted}
            pieceLabel={terms.pieceSingular}
            onReorder={onScenesDragEnd}
          />
        ) : chapters.length === 0 ? (
          <p className="px-2 py-4 text-sm text-[var(--wc-faint)]">
            No {terms.groupPlural.toLowerCase()} yet. Add one to begin.
          </p>
        ) : !mounted ? (
          <ul className="space-y-1">
            {chapters.map((chapter) => (
              <StaticChapter
                key={chapter.id}
                chapter={chapter}
                activeSceneId={params.sceneId}
                dropActive={overChapter === chapter.id && !!dragItem}
                onItemDragOver={() => dragItem && setOverChapter(chapter.id)}
                onItemDragLeave={() => setOverChapter((c) => (c === chapter.id ? null : c))}
                onItemDrop={() => dropOnChapter(chapter.id)}
              />
            ))}
          </ul>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onChapterDragEnd}
          >
            <SortableContext
              items={chapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1">
                {chapters.map((chapter) => (
                  <SortableChapter
                    key={chapter.id}
                    chapter={chapter}
                    activeSceneId={params.sceneId}
                    sensors={sensors}
                    pending={pending}
                    onAddScene={addScene}
                    onDragScenes={(e) => onScenesDragEnd(chapter.id, e)}
                    dropActive={overChapter === chapter.id && !!dragItem}
                    onItemDragOver={() => dragItem && setOverChapter(chapter.id)}
                    onItemDragLeave={() => setOverChapter((c) => (c === chapter.id ? null : c))}
                    onItemDrop={() => dropOnChapter(chapter.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4">
          <div className="px-2 flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">
              Uncategorized
            </span>
            <button
              onClick={() =>
                startTransition(async () => {
                  await createLooseScene(project.id);
                })
              }
              disabled={pending}
              className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-50"
              title="Add a loose item here"
            >
              + add
            </button>
          </div>
          {uncategorized.length === 0 ? (
            <p className="px-2 py-1 text-xs text-[var(--wc-faint)]">
              Loose items and moved-in exercises land here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {uncategorized.map((u) => (
                <li
                  key={`${u.kind}-${u.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `${u.kind}:${u.id}`);
                    setDragItem({ id: u.id, kind: u.kind });
                  }}
                  onDragEnd={() => {
                    setDragItem(null);
                    setOverChapter(null);
                  }}
                  className={dragItem?.id === u.id ? "opacity-50" : ""}
                >
                  <Link
                    href={
                      u.kind === "loose"
                        ? `/app/loose/${u.id}`
                        : `/app/exercises/${u.id}`
                    }
                    draggable={false}
                    className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] cursor-grab active:cursor-grabbing"
                    title={`${u.title}, drag onto a chapter to file it there`}
                  >
                    <span aria-hidden className="text-[10px] text-[var(--wc-faint)]">
                      {u.kind === "exercise" ? "🎲" : "✎"}
                    </span>
                    <span className="truncate">{u.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-[var(--wc-border)] p-3 space-y-2">
        <button
          onClick={terms.flat ? addPiece : addChapter}
          disabled={pending}
          className="w-full rounded-md bg-[var(--wc-slate)] px-3 py-2 text-sm text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-50"
        >
          + New {(terms.flat ? terms.pieceSingular : terms.groupSingular).toLowerCase()}
        </button>
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/app/publish"
            data-tour="publish"
            className="rounded-md px-2 py-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
            title="Prepare & export your book for publication"
          >
            ✦ Publish
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("wc:start-tour"))}
              className="rounded-md px-2 py-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
              title="Replay the studio tour"
            >
              Tour
            </button>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:bg-[var(--wc-paper)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SceneScrollToggle({
  firstSceneId,
  projectId,
  form,
}: {
  firstSceneId?: string;
  projectId: string;
  form: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const view = useEditorView(projectId, form);
  const [open, setOpen] = useState(false);
  const scrollActive = pathname === "/app/manuscript";
  const scenesHref = firstSceneId ? `/app/scene/${firstSceneId}` : "/app/write";

  function choose(fmt: "pageless" | "paged") {
    view.setPageFormat(fmt);
    setOpen(false);
    if (!scrollActive) router.push("/app/manuscript");
  }

  return (
    <div className="relative">
      <div
        data-tour="view-toggle"
        className="flex items-center rounded-md border border-[var(--wc-border)] overflow-hidden text-[11px]"
      >
        <Link
          href={scenesHref}
          className={`px-2 py-0.5 ${
            !scrollActive
              ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
              : "bg-[var(--wc-surface)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
          }`}
          title="Edit one scene at a time"
        >
          Scenes
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!scrollActive) router.push("/app/manuscript");
            setOpen((o) => !o);
          }}
          className={`flex items-center gap-1 border-l border-[var(--wc-border)] px-2 py-0.5 ${
            scrollActive
              ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
              : "bg-[var(--wc-surface)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
          }`}
          title="Scroll the whole manuscript — choose paged or pageless"
        >
          Scroll
          <span className="text-[8px] leading-none">▾</span>
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-36 rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-[11px] shadow-[var(--wc-shadow-md)]">
            {(["pageless", "paged"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => choose(fmt)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                  view.pageFormat === fmt
                    ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)]"
                    : "text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
                }`}
              >
                {fmt === "pageless" ? "Pageless" : "Paged"}
                {view.pageFormat === fmt && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type DropProps = {
  dropActive?: boolean;
  onItemDragOver?: () => void;
  onItemDragLeave?: () => void;
  onItemDrop?: () => void;
};

function dropHandlers(p: DropProps) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!p.onItemDragOver) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      p.onItemDragOver();
    },
    onDragLeave: () => p.onItemDragLeave?.(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      p.onItemDrop?.();
    },
  };
}

function StaticChapter({
  chapter,
  activeSceneId,
  ...drop
}: {
  chapter: Chapter;
  activeSceneId: string | undefined;
} & DropProps) {
  return (
    <li>
      <div
        {...dropHandlers(drop)}
        className={`flex items-center justify-between px-2 py-1.5 text-sm font-medium text-[var(--wc-muted)] rounded ${
          drop.dropActive ? "ring-2 ring-[var(--wc-slate)] bg-[var(--wc-paper)]" : ""
        }`}
      >
        <span className="flex-1 truncate">{chapter.title}</span>
      </div>
      <ul className="ml-2 border-l border-[var(--wc-border)] pl-2">
        {chapter.scenes.map((scene) => (
          <li key={scene.id}>
            <Link
              href={`/app/scene/${scene.id}`}
              className={`block truncate rounded px-2 py-1 text-sm ${
                activeSceneId === scene.id
                  ? "bg-[var(--wc-paper)] text-[var(--wc-ink)]"
                  : "text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
              }`}
            >
              {scene.title}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ProjectMetadata({ project }: { project: ProjectTree }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">
        Working title
      </div>
      <EditableTitle
        initial={project.title}
        onSave={(next) =>
          updateProjectMetadata(project.id, { title: next })
        }
        className="font-serif text-lg text-[var(--wc-ink)] block"
        inputClassName="font-serif text-lg w-full"
      />
      <div className="pt-1">
        <ProjectFormPill projectId={project.id} form={project.form} />
      </div>
      {/* Author/agent live in Prepare for publication now. */}
    </div>
  );
}

function ToolsRow() {
  const openGroup = useOrganize((s) => s.openGroup);
  const setBsOpen = useOrganize((s) => s.setBsOpen);
  const btn =
    "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] text-[var(--wc-muted)] hover:bg-[var(--wc-paper)] border border-[var(--wc-border)]";
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <button
        type="button"
        data-tour="brainstorm"
        onClick={() => setBsOpen(true)}
        className={btn}
        title="Open the Brainstorm panel"
      >
        <span aria-hidden className="text-base leading-none">💭</span>
        Brainstorm
      </button>
      <button
        type="button"
        data-tour="bible"
        onClick={() => openGroup("bible")}
        className={btn}
        title="Map · outline · characters"
      >
        <span aria-hidden className="text-base leading-none">📖</span>
        Story Bible
      </button>
      <button
        type="button"
        data-tour="organize"
        onClick={() => openGroup("organize")}
        className={btn}
        title="Notes · canvas"
      >
        <span aria-hidden className="text-base leading-none">🗂️</span>
        Organize
      </button>
      <button
        type="button"
        onClick={() => openGroup("tags")}
        className={btn}
        title="Tagged passages"
      >
        <span aria-hidden className="text-base leading-none">🏷️</span>
        Tags
      </button>
      <button
        type="button"
        data-tour="prompts"
        onClick={() => openGroup("prompts")}
        className={btn}
        title="Writing prompts for this project"
      >
        <span aria-hidden className="text-base leading-none">🎲</span>
        Prompts
      </button>
    </div>
  );
}

function SortableChapter({
  chapter,
  activeSceneId,
  sensors,
  pending,
  onAddScene,
  onDragScenes,
  ...drop
}: {
  chapter: Chapter;
  activeSceneId: string | undefined;
  sensors: ReturnType<typeof useSensors>;
  pending: boolean;
  onAddScene: (chapterId: string) => void;
  onDragScenes: (e: DragEndEvent) => void;
} & DropProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div
        {...dropHandlers(drop)}
        className={`flex items-center justify-between px-2 py-1.5 text-sm font-medium text-[var(--wc-muted)] group rounded ${
          drop.dropActive ? "ring-2 ring-[var(--wc-slate)] bg-[var(--wc-paper)]" : ""
        }`}
      >
        <span
          className="cursor-grab text-[var(--wc-faint)] hover:text-[var(--wc-faint)] mr-1 select-none"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⋮⋮
        </span>
        <Link
          href={`/app/chapter/${chapter.id}`}
          className="flex-1 hover:text-[var(--wc-ink)] truncate"
          title="Read whole chapter"
        >
          <EditableTitle
            initial={chapter.title}
            onSave={(next) => renameChapter(chapter.id, next)}
          />
        </Link>
        <button
          onClick={() => onAddScene(chapter.id)}
          disabled={pending}
          className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-50 ml-2"
          title="Add scene"
        >
          + scene
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragScenes}>
        <SortableContext
          items={chapter.scenes.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="ml-2 border-l border-[var(--wc-border)] pl-2">
            {chapter.scenes.map((scene) => (
              <SortableScene
                key={scene.id}
                scene={scene}
                active={activeSceneId === scene.id}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </li>
  );
}

/** Flat list of pieces (poetry / short story / essay), no chapter layer. */
function FlatPieces({
  chapters,
  activeSceneId,
  sensors,
  mounted,
  pieceLabel,
  onReorder,
}: {
  chapters: Chapter[];
  activeSceneId: string | undefined;
  sensors: ReturnType<typeof useSensors>;
  mounted: boolean;
  pieceLabel: string;
  onReorder: (chapterId: string, e: DragEndEvent) => void;
}) {
  const scenes = chapters.flatMap((c) => c.scenes);
  if (scenes.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-[var(--wc-faint)]">
        No {pieceLabel.toLowerCase()}s yet. Add one to begin.
      </p>
    );
  }
  if (!mounted) {
    return (
      <ul className="space-y-0.5 px-1">
        {scenes.map((s) => (
          <li key={s.id}>
            <Link
              href={`/app/scene/${s.id}`}
              className={`block truncate rounded px-2 py-1 text-sm ${
                activeSceneId === s.id
                  ? "bg-[var(--wc-paper)] text-[var(--wc-ink)]"
                  : "text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
              }`}
            >
              {s.title}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  const chapterOf = (id: string) => chapters.find((c) => c.scenes.some((s) => s.id === id));
  function onDragEnd(e: DragEndEvent) {
    const ch = chapterOf(String(e.active.id));
    if (ch) onReorder(ch.id, e);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5 px-1">
          {scenes.map((s) => (
            <SortableScene key={s.id} scene={s} active={activeSceneId === s.id} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableScene({ scene, active }: { scene: Scene; active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="group flex items-center">
      <span
        className="cursor-grab text-[var(--wc-faint)] hover:text-[var(--wc-faint)] mr-1 select-none opacity-0 group-hover:opacity-100"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        ⋮
      </span>
      <Link
        href={`/app/scene/${scene.id}`}
        className={`flex-1 truncate rounded px-2 py-1 text-sm ${
          active ? "bg-[var(--wc-paper)] text-[var(--wc-ink)]" : "text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
        }`}
      >
        <EditableTitle
          initial={scene.title}
          onSave={(next) => renameScene(scene.id, next)}
        />
      </Link>
    </li>
  );
}
