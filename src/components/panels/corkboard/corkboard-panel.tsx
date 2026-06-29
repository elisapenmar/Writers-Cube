"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chapter, ProjectTree, Scene } from "@/lib/types";
import { getOrCreateProject, reorderScenes, renameChapter } from "@/server/scenes";
import { updateSceneSynopsis, moveSceneToChapter } from "@/server/corkboard";
import { termsFor } from "@/lib/project-forms";
import { EditableTitle } from "@/components/editable-title";
import { useOrganize } from "@/store/organize-store";
import { openingLine } from "@/components/panels/corkboard/prose-preview";

/** Find which chapter currently holds a scene id, in the working copy. */
function chapterIdOfScene(chapters: Chapter[], sceneId: string): string | undefined {
  return chapters.find((c) => c.scenes.some((s) => s.id === sceneId))?.id;
}

export function CorkboardPanel() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectTree | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const setOpen = useOrganize((s) => s.setOpen);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const tree = await getOrCreateProject();
        if (!alive) return;
        setProject(tree);
        setChapters(tree.chapters);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the corkboard.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeScene = useMemo(() => {
    if (!activeId) return null;
    for (const c of chapters) {
      const s = c.scenes.find((x) => x.id === activeId);
      if (s) return s;
    }
    return null;
  }, [activeId, chapters]);

  function openScene(sceneId: string) {
    setOpen(false); // close the panel so the editor is visible
    router.push(`/app/scene/${sceneId}`);
  }

  function onSynopsisSaved(sceneId: string, synopsis: string) {
    setChapters((prev) =>
      prev.map((c) => ({
        ...c,
        scenes: c.scenes.map((s) => (s.id === sceneId ? { ...s, synopsis } : s)),
      })),
    );
    startTransition(async () => {
      await updateSceneSynopsis(sceneId, synopsis);
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeSceneId = String(active.id);
    const overId = String(over.id);

    const fromChapterId = chapterIdOfScene(chapters, activeSceneId);
    if (!fromChapterId) return;

    // `over` is either another card (scene id) or a column drop zone ("col:<id>").
    const toChapterId = overId.startsWith("col:")
      ? overId.slice(4)
      : chapterIdOfScene(chapters, overId);
    if (!toChapterId) return;

    if (fromChapterId === toChapterId) {
      // Reorder within the chapter.
      const chapter = chapters.find((c) => c.id === fromChapterId);
      if (!chapter) return;
      const oldIndex = chapter.scenes.findIndex((s) => s.id === activeSceneId);
      const newIndex = overId.startsWith("col:")
        ? chapter.scenes.length - 1
        : chapter.scenes.findIndex((s) => s.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const nextScenes = arrayMove(chapter.scenes, oldIndex, newIndex);
      setChapters((prev) =>
        prev.map((c) => (c.id === fromChapterId ? { ...c, scenes: nextScenes } : c)),
      );
      startTransition(async () => {
        await reorderScenes(
          fromChapterId,
          nextScenes.map((s) => s.id),
        );
      });
      return;
    }

    // Move between chapters: append to the target chapter.
    const moved = chapters
      .find((c) => c.id === fromChapterId)
      ?.scenes.find((s) => s.id === activeSceneId);
    if (!moved) return;
    setChapters((prev) =>
      prev.map((c) => {
        if (c.id === fromChapterId) {
          return { ...c, scenes: c.scenes.filter((s) => s.id !== activeSceneId) };
        }
        if (c.id === toChapterId) {
          return { ...c, scenes: [...c.scenes, { ...moved, chapter_id: toChapterId }] };
        }
        return c;
      }),
    );
    startTransition(async () => {
      await moveSceneToChapter(activeSceneId, toChapterId);
      router.refresh(); // keep the side-nav tree in sync
    });
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-sm text-[var(--wc-faint)]">
        Loading the corkboard…
      </div>
    );
  }

  const terms = termsFor(project.form);
  const totalScenes = chapters.reduce((n, c) => n + c.scenes.length, 0);

  if (totalScenes === 0) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center text-sm text-[var(--wc-faint)]">
        No {terms.pieceSingular.toLowerCase()}s yet. Add some from the side nav, then arrange
        them here.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[var(--wc-canvas)] p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-col gap-5">
          {chapters.map((chapter) => (
            <ChapterColumn
              key={chapter.id}
              chapter={chapter}
              pieceLabel={terms.pieceSingular}
              onOpen={openScene}
              onSynopsisSaved={onSynopsisSaved}
            />
          ))}
        </div>
        <DragOverlay>
          {activeScene ? (
            <CardShell scene={activeScene} pieceLabel={terms.pieceSingular} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function ChapterColumn({
  chapter,
  pieceLabel,
  onOpen,
  onSynopsisSaved,
}: {
  chapter: Chapter;
  pieceLabel: string;
  onOpen: (sceneId: string) => void;
  onSynopsisSaved: (sceneId: string, synopsis: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${chapter.id}` });
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <EditableTitle
          initial={chapter.title}
          onSave={(next) => renameChapter(chapter.id, next)}
          className="font-serif text-sm text-[var(--wc-ink)]"
          inputClassName="font-serif text-sm"
        />
        <span className="text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">
          {chapter.scenes.length} {pieceLabel.toLowerCase()}
          {chapter.scenes.length === 1 ? "" : "s"}
        </span>
      </div>
      <SortableContext items={chapter.scenes.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 rounded-lg p-3 ${
            isOver
              ? "ring-2 ring-[var(--wc-slate)] bg-[var(--wc-paper)]"
              : "border border-dashed border-[var(--wc-border)]"
          }`}
        >
          {chapter.scenes.length === 0 ? (
            <p className="col-span-full py-4 text-center text-xs text-[var(--wc-faint)]">
              Drop a card here.
            </p>
          ) : (
            chapter.scenes.map((scene) => (
              <SortableCard
                key={scene.id}
                scene={scene}
                pieceLabel={pieceLabel}
                onOpen={onOpen}
                onSynopsisSaved={onSynopsisSaved}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  scene,
  pieceLabel,
  onOpen,
  onSynopsisSaved,
}: {
  scene: Scene;
  pieceLabel: string;
  onOpen: (sceneId: string) => void;
  onSynopsisSaved: (sceneId: string, synopsis: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <CardShell
        scene={scene}
        pieceLabel={pieceLabel}
        onOpen={onOpen}
        onSynopsisSaved={onSynopsisSaved}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/** The visual index card. Used both in place and (read-only) in the drag overlay. */
function CardShell({
  scene,
  pieceLabel,
  onOpen,
  onSynopsisSaved,
  handleProps,
  dragging,
}: {
  scene: Scene;
  pieceLabel: string;
  onOpen?: (sceneId: string) => void;
  onSynopsisSaved?: (sceneId: string, synopsis: string) => void;
  handleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scene.synopsis ?? "");
  const synopsis = (scene.synopsis ?? "").trim();
  const fallback = synopsis ? "" : openingLine(scene.content);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== synopsis) onSynopsisSaved?.(scene.id, next);
  }

  return (
    <div
      className={`flex h-44 flex-col rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] p-3 text-left shadow-[var(--wc-shadow-md)] ${
        dragging ? "rotate-1" : ""
      }`}
    >
      <div className="mb-1 flex items-start gap-1">
        <span
          {...(handleProps ?? {})}
          className="-ml-1 mt-0.5 cursor-grab select-none text-[var(--wc-faint)] active:cursor-grabbing"
          title="Drag to reorder or move"
          aria-hidden
        >
          ⠿
        </span>
        <button
          type="button"
          onClick={() => onOpen?.(scene.id)}
          disabled={!onOpen}
          className="flex-1 truncate text-left font-serif text-sm text-[var(--wc-ink)] hover:underline"
          title={`Open ${scene.title}`}
        >
          {scene.title}
        </button>
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            if (e.key === "Escape") {
              setDraft(synopsis);
              setEditing(false);
            }
          }}
          placeholder="One-line synopsis…"
          className="flex-1 resize-none rounded border border-[var(--wc-border)] bg-[var(--wc-canvas)] p-1.5 text-xs leading-snug text-[var(--wc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--wc-slate)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!onSynopsisSaved) return;
            setDraft(synopsis);
            setEditing(true);
          }}
          disabled={!onSynopsisSaved}
          className="flex-1 overflow-hidden text-left text-xs leading-snug"
          title="Click to edit the synopsis"
        >
          {synopsis ? (
            <span className="text-[var(--wc-muted)]">{synopsis}</span>
          ) : fallback ? (
            <span className="italic text-[var(--wc-faint)]">{fallback}</span>
          ) : (
            <span className="italic text-[var(--wc-faint)]">
              Add a {pieceLabel.toLowerCase()} synopsis…
            </span>
          )}
        </button>
      )}
    </div>
  );
}
