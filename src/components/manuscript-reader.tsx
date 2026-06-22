"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Indent } from "@/lib/indent";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import {
  updateSceneContent,
  splitSceneAt,
  createScene,
  createChapter,
  mergeScene,
} from "@/server/scenes";
import { updateLooseSceneContent } from "@/server/loose";
import { updateExercise } from "@/server/prompts";
import { SceneHistory } from "@/components/scene-history";
import { FindReplace } from "@/components/find-replace";
import { EditorToolbar } from "@/components/editor-toolbar";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";
import { TypewriterMode } from "@/components/typewriter-mode";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function countWords(doc: unknown): number {
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ManuscriptScene = {
  id: string;
  title: string;
  content: unknown;
  /** undefined = chapter scene; "loose"/"exercise" = uncategorized item. */
  kind?: "loose" | "exercise";
  /** The owning chapter id (for chapter scenes only). */
  chapterId?: string;
};
export type ManuscriptChapter = {
  id: string;
  title: string;
  scenes: ManuscriptScene[];
};

export function ManuscriptReader({
  projectId,
  projectTitle,
  chapters,
  looseScenes = [],
}: {
  projectId: string;
  projectTitle: string;
  chapters: ManuscriptChapter[];
  looseScenes?: ManuscriptScene[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [activeScene, setActiveScene] = useState<ManuscriptScene | null>(null);
  const [focusScene, setFocusScene] = useState<ManuscriptScene | null>(null);
  const [historyScene, setHistoryScene] = useState<ManuscriptScene | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Per-scene content override + version, so a block remounts with the text it
  // ended up with after a focus session or a split.
  const [override, setOverride] = useState<Record<string, unknown>>({});
  const [version, setVersion] = useState<Record<string, number>>({});

  function bumpStatus(s: SaveStatus, t?: string) {
    setStatus(s);
    if (t) setSavedAt(t);
  }

  function remount(sceneId: string, content: unknown) {
    // The block's editor will be torn down — drop the stale reference so the
    // toolbar doesn't touch a destroyed editor.
    setActiveEditor(null);
    setOverride((o) => ({ ...o, [sceneId]: content }));
    setVersion((v) => ({ ...v, [sceneId]: (v[sceneId] ?? 0) + 1 }));
  }

  function persistFor(scene: ManuscriptScene) {
    return (doc: unknown) => {
      if (scene.kind === "loose") return updateLooseSceneContent(scene.id, doc).then(() => {});
      if (scene.kind === "exercise") return updateExercise(scene.id, { content: doc }).then(() => {});
      return updateSceneContent(scene.id, doc).then(() => {});
    };
  }

  const renderScene = (scene: ManuscriptScene) => (
    <SceneBlock
      key={`${scene.id}:${version[scene.id] ?? 0}`}
      scene={scene}
      projectId={projectId}
      contentOverride={override[scene.id]}
      onStatus={bumpStatus}
      onActivate={(editor) => {
        setActiveEditor(editor);
        setActiveScene(scene);
      }}
      onSplitResult={(firstContent) => {
        remount(scene.id, firstContent);
        router.refresh();
      }}
      onStructureChange={() => router.refresh()}
    />
  );

  const totalScenes =
    chapters.reduce((n, c) => n + c.scenes.length, 0) + looseScenes.length;

  return (
    <div className="relative flex-1 flex flex-col h-screen bg-[var(--wc-page)]">
      {findOpen && activeEditor && (
        <FindReplace editor={activeEditor} onClose={() => setFindOpen(false)} />
      )}
      {/* Sticky toolbar — operates on whichever block is focused */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-6 py-2">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <EditorToolbar editor={activeEditor} />
        </div>
        <button
          onClick={() => setFindOpen(true)}
          disabled={!activeScene}
          className="shrink-0 rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          title="Find & replace in the focused scene (⌘F)"
        >
          Find
        </button>
        <button
          onClick={() => activeScene && setHistoryScene(activeScene)}
          disabled={!activeScene}
          className="shrink-0 rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          title="Version history of the focused scene"
        >
          History
        </button>
        <button
          onClick={() => setFocusScene(activeScene)}
          disabled={!activeScene}
          className="shrink-0 rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
          title="Write the focused scene in distraction-free focus mode"
        >
          ✶ Focus
        </button>
        <span className="shrink-0 text-xs text-[var(--wc-faint)]">
          <SaveLabel status={status} savedAt={savedAt} />
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">
          {totalScenes === 0 && (
            <p className="text-sm text-[var(--wc-faint)] text-center py-16">
              Nothing to scroll yet — add chapters and scenes from the sidebar.
            </p>
          )}
          {chapters.map((chapter) => (
            <section key={chapter.id} className="mb-10">
              <h2 className="font-serif text-2xl text-[var(--wc-ink)] mb-4 pb-1 border-b border-[var(--wc-border)]">
                {chapter.title}
              </h2>
              {chapter.scenes.length === 0 ? (
                <p className="text-sm text-[var(--wc-faint)] italic">No scenes yet.</p>
              ) : (
                chapter.scenes.map(renderScene)
              )}
            </section>
          ))}

          {looseScenes.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-2xl text-[var(--wc-ink)] mb-4 pb-1 border-b border-[var(--wc-border)]">
                Uncategorized
              </h2>
              {looseScenes.map(renderScene)}
            </section>
          )}
        </div>
      </div>

      {focusScene && (
        <TypewriterMode
          scene={{
            id: focusScene.id,
            title: focusScene.title,
            content: override[focusScene.id] ?? focusScene.content,
            word_count: countWords(override[focusScene.id] ?? focusScene.content),
          }}
          persist={persistFor(focusScene)}
          onExit={(finalDoc) => {
            const id = focusScene.id;
            if (finalDoc) remount(id, finalDoc);
            setFocusScene(null);
          }}
        />
      )}

      {historyScene && (
        <SceneHistory
          sceneId={historyScene.id}
          sceneTitle={historyScene.title}
          onClose={() => setHistoryScene(null)}
          onRestore={(content) => remount(historyScene.id, content)}
        />
      )}
    </div>
  );
}

function SceneBlock({
  scene,
  projectId,
  contentOverride,
  onStatus,
  onActivate,
  onSplitResult,
  onStructureChange,
}: {
  scene: ManuscriptScene;
  projectId: string;
  contentOverride?: unknown;
  onStatus: (status: SaveStatus, savedAt?: string) => void;
  onActivate: (editor: Editor) => void;
  onSplitResult: (firstContent: unknown) => void;
  onStructureChange: () => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockIndex: number } | null>(null);
  const isScene = !scene.kind;

  const editor = useEditor(
    {
      extensions: [StarterKit, Underline, Indent, TextStyle, FontFamily, ...ALL_TAG_MARKS],
      content: (contentOverride as object | null) ??
        (scene.content as object | null) ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed",
        },
      },
      onFocus: ({ editor }) => onActivate(editor),
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        onStatus("saving");
        const doc = editor.getJSON();
        saveTimer.current = setTimeout(() => {
          void save(doc);
        }, 800);
      },
    },
    [scene.id],
  );

  async function save(doc: unknown) {
    try {
      let savedAt: string;
      if (scene.kind === "loose") {
        savedAt = (await updateLooseSceneContent(scene.id, doc)).savedAt;
      } else if (scene.kind === "exercise") {
        await updateExercise(scene.id, { content: doc });
        savedAt = new Date().toISOString();
      } else {
        savedAt = (await updateSceneContent(scene.id, doc)).savedAt;
      }
      onStatus("saved", savedAt);
    } catch {
      onStatus("error");
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        void save(editor.getJSON());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  useEffect(() => {
    const handler = () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        void save(editor.getJSON());
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function onContextMenu(e: React.MouseEvent) {
    if (!editor) return;
    e.preventDefault();
    // posAtCoords is null when clicking past the end of a line — fall back to
    // the caret so the menu always opens.
    const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const pos = coords?.pos ?? editor.state.selection.from;
    const blockIndex = editor.state.doc.resolve(pos).index(0);
    onActivate(editor);
    setCtxMenu({ x: e.clientX, y: e.clientY, blockIndex });
  }

  async function splitHere(into: "scenes" | "chapters") {
    if (!ctxMenu || !editor || !isScene) return;
    const blockIndex = ctxMenu.blockIndex;
    setCtxMenu(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await save(editor.getJSON());
    try {
      const { firstContent } = await splitSceneAt(scene.id, blockIndex, into);
      onSplitResult(firstContent);
    } catch {
      onStatus("error");
    }
  }

  function insertSceneBreak() {
    setCtxMenu(null);
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "paragraph", content: [{ type: "text", text: "* * *" }] })
      .run();
  }

  async function newScene() {
    setCtxMenu(null);
    if (!scene.chapterId) return;
    await createScene(scene.chapterId);
    onStructureChange();
  }

  async function newChapter() {
    setCtxMenu(null);
    await createChapter(projectId);
    onStructureChange();
  }

  async function merge(direction: "previous" | "next") {
    setCtxMenu(null);
    if (!isScene) return;
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor) await save(editor.getJSON());
      await mergeScene(scene.id, direction);
      onStructureChange();
    } catch {
      onStatus("error");
    }
  }

  return (
    <div className="wc-scene-block mb-6 group" onContextMenu={onContextMenu}>
      <div className="text-[11px] uppercase tracking-wider text-[var(--wc-faint)] mb-1">
        {scene.title}
      </div>
      {editor && <TagBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />

      {ctxMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu(null);
            }}
          />
          <div
            className="fixed z-50 w-56 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-sm shadow-xl"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 240),
              top: Math.min(ctxMenu.y, window.innerHeight - 220),
            }}
          >
            {isScene && (
              <>
                <CtxItem onClick={() => splitHere("scenes")}>✂ Split into a new scene here</CtxItem>
                <CtxItem onClick={() => splitHere("chapters")}>✂ Split into a new chapter here</CtxItem>
                <CtxDivider />
              </>
            )}
            <CtxItem onClick={insertSceneBreak}>⁂ Insert scene break</CtxItem>
            {isScene && (
              <>
                <CtxDivider />
                <CtxItem onClick={() => merge("previous")}>⇡ Merge with previous scene</CtxItem>
                <CtxItem onClick={() => merge("next")}>⇣ Merge with next scene</CtxItem>
                <CtxDivider />
                <CtxItem onClick={newScene}>＋ New scene in this chapter</CtxItem>
                <CtxItem onClick={newChapter}>＋ New chapter</CtxItem>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CtxItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-md px-3 py-1.5 text-left text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
    >
      {children}
    </button>
  );
}

function CtxDivider() {
  return <div className="my-1 border-t border-[var(--wc-border)]" />;
}

function SaveLabel({
  status,
  savedAt,
}: {
  status: SaveStatus;
  savedAt: string | null;
}) {
  if (status === "saving") return <span>Saving…</span>;
  if (status === "error") return <span className="text-red-600">Save failed</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return <span>Saved at {hh}:{mm}</span>;
  }
  return <span>&nbsp;</span>;
}
