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
  renameChapter,
  renameScene,
  reorderChapters,
  reorderScenes,
  updateProjectMetadata,
  signOut,
} from "@/server/scenes";
import { EditableTitle } from "@/components/editable-title";
import { createLooseScene } from "@/server/loose";
import { useOrganize } from "@/store/organize-store";
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
      <aside className="w-12 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-screen items-center py-3 gap-3">
        <button
          onClick={toggleNavCollapsed}
          className="w-8 h-8 rounded-lg text-zinc-500 hover:bg-zinc-100 grid place-items-center"
          title="Expand side nav"
        >
          <SidebarToggle collapsed />
        </button>
        <div className="text-[10px] text-zinc-400 [writing-mode:vertical-rl] rotate-180 font-serif tracking-wider">
          {project.title}
        </div>
      </aside>
    );
  }

  const firstSceneId = chapters[0]?.scenes[0]?.id;

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-screen">
      {/* Header: dashboard + project identity */}
      <div className="px-3 pt-2.5 pb-3 border-b border-zinc-200">
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 rounded-lg px-1.5 py-1 hover:bg-zinc-100"
            title="Back to dashboard"
          >
            <CubeMark className="text-[var(--wc-slate)]" /> Dashboard
          </Link>
          <button
            onClick={toggleNavCollapsed}
            className="w-7 h-7 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 grid place-items-center"
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
      <div className="px-3 py-2 border-b border-zinc-200">
        <ToolsRow />
      </div>

      {/* Chapters header + view toggle */}
      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-zinc-400">
          Chapters
        </span>
        <SceneScrollToggle firstSceneId={firstSceneId} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {chapters.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500">
            No chapters yet. Add one to begin.
          </p>
        ) : !mounted ? (
          <ul className="space-y-1">
            {chapters.map((chapter) => (
              <StaticChapter key={chapter.id} chapter={chapter} activeSceneId={params.sceneId} />
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
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4">
          <div className="px-2 flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">
              Uncategorized
            </span>
            <button
              onClick={() =>
                startTransition(async () => {
                  await createLooseScene(project.id);
                })
              }
              disabled={pending}
              className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-50"
              title="Add a loose item here"
            >
              + add
            </button>
          </div>
          {uncategorized.length === 0 ? (
            <p className="px-2 py-1 text-xs text-zinc-400">
              Loose items and moved-in exercises land here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {uncategorized.map((u) => (
                <li key={`${u.kind}-${u.id}`}>
                  <Link
                    href={
                      u.kind === "loose"
                        ? `/app/loose/${u.id}`
                        : `/app/exercises/${u.id}`
                    }
                    className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
                    title={u.title}
                  >
                    <span aria-hidden className="text-[10px] text-zinc-400">
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

      <div className="border-t border-zinc-200 p-3 space-y-2">
        <button
          onClick={addChapter}
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          + New chapter
        </button>
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/app/publish"
            className="rounded-md px-2 py-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            title="Prepare & export your book for publication"
          >
            ✦ Publish
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function SceneScrollToggle({ firstSceneId }: { firstSceneId?: string }) {
  const pathname = usePathname();
  const scrollActive = pathname === "/app/manuscript";
  const scenesHref = firstSceneId ? `/app/scene/${firstSceneId}` : "/app/write";
  return (
    <div className="flex items-center rounded-md border border-zinc-200 overflow-hidden text-[11px]">
      <Link
        href={scenesHref}
        className={`px-2 py-0.5 ${
          !scrollActive
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-600 hover:bg-zinc-50"
        }`}
        title="Edit one scene at a time"
      >
        Scenes
      </Link>
      <Link
        href="/app/manuscript"
        className={`px-2 py-0.5 border-l border-zinc-200 ${
          scrollActive
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-600 hover:bg-zinc-50"
        }`}
        title="Scroll the whole manuscript"
      >
        Scroll
      </Link>
    </div>
  );
}

function StaticChapter({
  chapter,
  activeSceneId,
}: {
  chapter: Chapter;
  activeSceneId: string | undefined;
}) {
  return (
    <li>
      <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-zinc-700">
        <span className="flex-1 truncate">{chapter.title}</span>
      </div>
      <ul className="ml-2 border-l border-zinc-200 pl-2">
        {chapter.scenes.map((scene) => (
          <li key={scene.id}>
            <Link
              href={`/app/scene/${scene.id}`}
              className={`block truncate rounded px-2 py-1 text-sm ${
                activeSceneId === scene.id
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50"
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
      <div className="text-[10px] uppercase tracking-widest text-zinc-400">
        Working title
      </div>
      <EditableTitle
        initial={project.title}
        onSave={(next) =>
          updateProjectMetadata(project.id, { title: next })
        }
        className="font-serif text-lg text-zinc-900 block"
        inputClassName="font-serif text-lg w-full"
      />
      <div className="pt-2 space-y-0.5">
        <MetaLine
          label="by"
          value={project.author_name}
          placeholder="Your name"
          onSave={(v) =>
            updateProjectMetadata(project.id, { author_name: v })
          }
        />
        <MetaLine
          label="agent"
          value={project.agent_name}
          placeholder="—"
          onSave={(v) =>
            updateProjectMetadata(project.id, { agent_name: v })
          }
        />
      </div>
    </div>
  );
}

function MetaLine({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onSave: (next: string | null) => Promise<unknown> | unknown;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? "")) {
      await onSave(next.length === 0 ? null : next);
    }
  }

  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-zinc-400 w-10 shrink-0">{label}</span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          className="flex-1 bg-white border border-zinc-300 rounded px-1 py-0.5 outline-none text-zinc-800"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left truncate hover:text-zinc-900 ${
            value ? "text-zinc-600" : "text-zinc-300 italic"
          }`}
          title="Click to edit"
        >
          {value || placeholder}
        </button>
      )}
    </div>
  );
}

function ToolsRow() {
  const openGroup = useOrganize((s) => s.openGroup);
  const setBsOpen = useOrganize((s) => s.setBsOpen);
  const btn =
    "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-100 border border-zinc-200";
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <button
        type="button"
        onClick={() => setBsOpen(true)}
        className={btn}
        title="Open the Brainstorm panel"
      >
        <span aria-hidden className="text-base leading-none">💭</span>
        Brainstorm
      </button>
      <button
        type="button"
        onClick={() => openGroup("bible")}
        className={btn}
        title="Map · outline · characters"
      >
        <span aria-hidden className="text-base leading-none">📖</span>
        Story Bible
      </button>
      <button
        type="button"
        onClick={() => openGroup("organize")}
        className={btn}
        title="Notes · canvas"
      >
        <span aria-hidden className="text-base leading-none">🗂️</span>
        Organize
      </button>
      <Link href="/app/tags" className={btn} title="Tagged passages">
        <span aria-hidden className="text-base leading-none">🏷️</span>
        Tags
      </Link>
      <Link href="/app/prompts" className={btn} title="Writing prompts for this project">
        <span aria-hidden className="text-base leading-none">🎲</span>
        Prompts
      </Link>
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
}: {
  chapter: Chapter;
  activeSceneId: string | undefined;
  sensors: ReturnType<typeof useSensors>;
  pending: boolean;
  onAddScene: (chapterId: string) => void;
  onDragScenes: (e: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-zinc-700 group">
        <span
          className="cursor-grab text-zinc-300 hover:text-zinc-500 mr-1 select-none"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⋮⋮
        </span>
        <Link
          href={`/app/chapter/${chapter.id}`}
          className="flex-1 hover:text-zinc-900 truncate"
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
          className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-50 ml-2"
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
          <ul className="ml-2 border-l border-zinc-200 pl-2">
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
        className="cursor-grab text-zinc-300 hover:text-zinc-500 mr-1 select-none opacity-0 group-hover:opacity-100"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        ⋮
      </span>
      <Link
        href={`/app/scene/${scene.id}`}
        className={`flex-1 truncate rounded px-2 py-1 text-sm ${
          active ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"
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
