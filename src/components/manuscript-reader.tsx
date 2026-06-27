"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { RTE_EXTENSIONS } from "@/lib/editor-extensions";
import {
  updateSceneContent,
  splitSceneAt,
  createScene,
  createChapter,
  mergeScene,
  renameChapter,
  startFirstElement,
} from "@/server/scenes";
import { EditableTitle } from "@/components/editable-title";
import { updateLooseSceneContent } from "@/server/loose";
import { updateExercise } from "@/server/prompts";
import { useCollab } from "@/lib/yjs/use-collab";
import { SceneHistory } from "@/components/scene-history";
import { FindReplace } from "@/components/find-replace";
import { EditorToolbar } from "@/components/editor-toolbar";
import { EditorViewOptions } from "@/components/editor-view-options";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";
import { TypewriterMode } from "@/components/typewriter-mode";
import { useEditorView } from "@/store/editor-view-store";
import { termsFor } from "@/lib/project-forms";
import { lookupMisspelling, acceptWord, spellEnabled, setSpellEnabled, type SpellHit } from "@/lib/spellcheck";
import { useClampedMenuPosition } from "@/lib/menu-position";

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
  /** CAS version token at load time (scene/loose only). */
  updated_at?: string;
};
export type ManuscriptChapter = {
  id: string;
  title: string;
  scenes: ManuscriptScene[];
};

export function ManuscriptReader({
  projectId,
  projectTitle,
  form,
  chapters,
  looseScenes = [],
}: {
  projectId: string;
  projectTitle: string;
  form?: string;
  chapters: ManuscriptChapter[];
  looseScenes?: ManuscriptScene[];
}) {
  const router = useRouter();
  const view = useEditorView(projectId, form);
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
    // The block's editor will be torn down, drop the stale reference so the
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

  // The first scene's editor becomes active on load, so the toolbar is live
  // before the writer clicks into the manuscript.
  const firstSceneId =
    chapters.find((c) => c.scenes.length)?.scenes[0]?.id ?? looseScenes[0]?.id;

  const renderScene = (scene: ManuscriptScene) => (
    <SceneBlock
      key={`${scene.id}:${version[scene.id] ?? 0}`}
      scene={scene}
      projectId={projectId}
      contentOverride={override[scene.id]}
      defaultActive={scene.id === firstSceneId}
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
      {/* Sticky toolbar, operates on whichever block is focused */}
      <div className="sticky top-0 z-20 border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-6 py-2">
        <EditorToolbar
          editor={activeEditor}
          trailing={
            <>
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
              <EditorViewOptions view={view} />
              <span className="shrink-0 text-xs text-[var(--wc-faint)]">
                <SaveLabel status={status} savedAt={savedAt} />
              </span>
            </>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-8 py-10 bg-[var(--wc-page)]">
        <div
          className={`wc-doc mx-auto ${
            view.pageFormat === "paged" ? "wc-doc-paged" : "wc-doc-pageless"
          }`}
          data-space-before={view.spaceBefore}
          data-space-after={view.spaceAfter}
          data-show-margins={view.showMargins}
          style={
            {
              "--wc-line": String(view.lineSpacing),
              columnCount: view.columns > 1 ? view.columns : undefined,
              columnGap: view.columns > 1 ? "2.75rem" : undefined,
            } as CSSProperties
          }
        >
          {totalScenes === 0 && (
            <DraftBlock
              projectId={projectId}
              form={form}
              onEditor={setActiveEditor}
              onCreated={() => router.refresh()}
            />
          )}
          {chapters.map((chapter) => (
            <section key={chapter.id} className="mb-10">
              <h2 className="font-serif text-2xl text-[var(--wc-ink)] mb-4 pb-1 border-b border-[var(--wc-border)]">
                <EditableTitle
                  initial={chapter.title}
                  onSave={async (next) => {
                    await renameChapter(chapter.id, next);
                    router.refresh();
                  }}
                  className="block"
                  inputClassName="font-serif text-2xl w-full"
                />
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

/**
 * The blank writing surface shown for a brand-new, empty project. The writer can
 * just start typing — the first real element is created on the fly once there are
 * actual words, and the structure is synced into the sidebar when they click away.
 */
function DraftBlock({
  projectId,
  form,
  onEditor,
  onCreated,
}: {
  projectId: string;
  form?: string;
  onEditor: (editor: Editor | null) => void;
  onCreated: () => void;
}) {
  const createdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const syncedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasText, setHasText] = useState(false);
  const pieceLabel = termsFor(form).pieceSingular.toLowerCase();

  const editor = useEditor(
    {
      extensions: RTE_EXTENSIONS,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed min-h-[45vh]",
        },
      },
      onFocus: ({ editor }) => onEditor(editor),
      onUpdate: ({ editor }) => {
        const doc = editor.getJSON();
        setHasText(countWords(doc) > 0);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void persist(doc), 700);
      },
    },
    [],
  );

  async function persist(doc: unknown) {
    if (!createdRef.current) {
      if (creatingRef.current || countWords(doc) === 0) return;
      creatingRef.current = true;
      try {
        const { sceneId } = await startFirstElement(projectId, doc);
        createdRef.current = sceneId;
      } catch {
        creatingRef.current = false;
      }
      return;
    }
    await updateSceneContent(createdRef.current, doc).catch(() => {});
  }

  // Once a real element exists, flush any pending save and sync the structure
  // (sidebar + scroll) when the writer moves focus away from the draft.
  function handleBlur() {
    if (!createdRef.current || !editor || syncedRef.current) return;
    syncedRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void updateSceneContent(createdRef.current, editor.getJSON())
      .catch(() => {})
      .finally(() => onCreated());
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <div className="relative" onBlur={handleBlur}>
      {!hasText && (
        <div className="pointer-events-none absolute left-0 top-0 select-none font-serif text-lg text-[var(--wc-faint)]">
          Start typing to begin your {pieceLabel}…
        </div>
      )}
      {editor && <TagBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
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
  defaultActive = false,
}: {
  scene: ManuscriptScene;
  projectId: string;
  contentOverride?: unknown;
  onStatus: (status: SaveStatus, savedAt?: string) => void;
  onActivate: (editor: Editor) => void;
  onSplitResult: (firstContent: unknown) => void;
  onStructureChange: () => void;
  defaultActive?: boolean;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CAS version token for scene/loose blocks (see editor.tsx).
  const baseUpdatedAt = useRef<string | null>(scene.updated_at ?? null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockIndex: number; pos: number; spell?: SpellHit | null } | null>(null);
  const menuRef = useClampedMenuPosition(ctxMenu?.x ?? null, ctxMenu?.y ?? null);
  const isScene = !scene.kind;

  // Live co-editing per block (flag-gated). Exercises have no CRDT store, so
  // they stay on the classic blob path (kind = null).
  const collabKind = scene.kind === "loose" ? "loose_scene" : scene.kind === "exercise" ? null : "scene";
  const collab = useCollab(collabKind, scene.id);
  const collabReady = collab.mode === "ready";

  function seedCollabDoc(ed: Editor) {
    if (collab.mode !== "ready" || !collab.shouldSeed) return;
    const doc = collab.provider.doc;
    const meta = doc.getMap("meta");
    if (meta.get("seeded")) return;
    const frag = doc.getXmlFragment("default");
    const blob = (contentOverride as object | null) ?? (scene.content as object | null);
    if (frag.length === 0 && blob && countWords(blob) > 0) {
      ed.commands.setContent(blob, { emitUpdate: true });
    }
    meta.set("seeded", true);
  }

  const editor = useEditor(
    {
      extensions: collabReady ? collab.extensions : RTE_EXTENSIONS,
      content: collabReady
        ? undefined
        : (contentOverride as object | null) ??
          (scene.content as object | null) ?? {
            type: "doc",
            content: [{ type: "paragraph" }],
          },
      editable: collab.mode !== "loading",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed",
        },
      },
      onCreate: collabReady ? ({ editor }) => seedCollabDoc(editor) : undefined,
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
    [scene.id, collabReady],
  );

  // Make the first block active on load so the shared toolbar is live before the
  // writer clicks into the manuscript.
  useEffect(() => {
    if (defaultActive && editor) onActivate(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultActive, editor]);

  async function save(doc: unknown) {
    try {
      let savedAt: string;
      if (scene.kind === "loose") {
        savedAt = (await updateLooseSceneContent(scene.id, doc, baseUpdatedAt.current)).savedAt;
        baseUpdatedAt.current = savedAt;
      } else if (scene.kind === "exercise") {
        await updateExercise(scene.id, { content: doc });
        savedAt = new Date().toISOString();
      } else {
        savedAt = (await updateSceneContent(scene.id, doc, baseUpdatedAt.current)).savedAt;
        baseUpdatedAt.current = savedAt;
      }
      onStatus("saved", savedAt);
    } catch {
      onStatus("error");
    }
  }

  useEffect(() => {
    // New scene loaded: reset the CAS token to this scene's version.
    baseUpdatedAt.current = scene.updated_at ?? null;
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
    // posAtCoords is null when clicking past the end of a line, fall back to
    // the caret so the menu always opens.
    const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const pos = coords?.pos ?? editor.state.selection.from;
    const blockIndex = editor.state.doc.resolve(pos).index(0);
    const spell = lookupMisspelling(editor, pos);
    onActivate(editor);
    setCtxMenu({ x: e.clientX, y: e.clientY, blockIndex, pos, spell });
  }

  function applySuggestion(hit: SpellHit, word: string) {
    setCtxMenu(null);
    editor?.chain().focus().insertContentAt({ from: hit.from, to: hit.to }, word).run();
  }
  function addToDictionary(word: string) {
    setCtxMenu(null);
    void acceptWord(word);
  }
  function toggleSpelling() {
    setCtxMenu(null);
    setSpellEnabled(!spellEnabled());
  }

  function insertFootnoteHere() {
    const pos = ctxMenu?.pos;
    setCtxMenu(null);
    if (!editor) return;
    onActivate(editor);
    const chain = editor.chain().focus();
    if (typeof pos === "number") chain.setTextSelection(pos);
    chain.addFootnote().run();
  }

  // Standard editing commands so the right-click menu feels complete.
  function doCut() {
    setCtxMenu(null);
    editor?.commands.focus();
    document.execCommand("cut");
  }
  function doCopy() {
    setCtxMenu(null);
    editor?.commands.focus();
    document.execCommand("copy");
  }
  async function doPaste() {
    setCtxMenu(null);
    if (!editor) return;
    editor.commands.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      /* clipboard blocked — the writer can still use Cmd/Ctrl-V */
    }
  }
  function selectAll() {
    setCtxMenu(null);
    editor?.chain().focus().selectAll().run();
  }
  function clearFormatting() {
    setCtxMenu(null);
    editor?.chain().focus().unsetAllMarks().run();
  }
  function editLink() {
    setCtxMenu(null);
    if (!editor) return;
    const prev = (editor.getAttributes("link").href as string) || "";
    const url = window.prompt("Link URL (leave blank to remove):", prev);
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  // Open the scene-structure menu from the ⋯ button, anchored under it, using
  // the current caret position as the split point.
  function openMenuFromButton(e: React.MouseEvent) {
    if (!editor) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = editor.state.selection.from;
    const blockIndex = editor.state.doc.resolve(pos).index(0);
    onActivate(editor);
    setCtxMenu({ x: rect.right, y: rect.bottom, blockIndex, pos });
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
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[11px] uppercase tracking-wider text-[var(--wc-faint)]">
          {scene.title}
        </div>
        <button
          type="button"
          onClick={openMenuFromButton}
          title="Scene actions (split, merge, new) — also on right-click"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded px-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)] transition-opacity"
          aria-label="Scene actions"
        >
          ⋯
        </button>
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
            ref={menuRef}
            className="fixed z-50 w-60 max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-sm shadow-xl"
          >
            {ctxMenu.spell && (
              <>
                {ctxMenu.spell.suggestions.length > 0 ? (
                  ctxMenu.spell.suggestions.map((s) => (
                    <CtxItem key={s} onClick={() => applySuggestion(ctxMenu.spell!, s)}>
                      <span className="font-medium text-[var(--wc-ink)]">{s}</span>
                    </CtxItem>
                  ))
                ) : (
                  <div className="px-3 py-1.5 text-xs text-[var(--wc-faint)]">No suggestions</div>
                )}
                <CtxItem onClick={() => addToDictionary(ctxMenu.spell!.word)}>
                  ＋ Add “{ctxMenu.spell.word}” to dictionary
                </CtxItem>
                <CtxDivider />
              </>
            )}
            <CtxItem onClick={doCut} shortcut="⌘X">Cut</CtxItem>
            <CtxItem onClick={doCopy} shortcut="⌘C">Copy</CtxItem>
            <CtxItem onClick={doPaste} shortcut="⌘V">Paste</CtxItem>
            <CtxItem onClick={selectAll} shortcut="⌘A">Select all</CtxItem>
            <CtxDivider />
            <CtxItem onClick={editLink} shortcut="⌘K">Insert / edit link</CtxItem>
            <CtxItem onClick={insertFootnoteHere}>Insert footnote here</CtxItem>
            <CtxItem onClick={clearFormatting}>Clear formatting</CtxItem>
            <CtxItem onClick={toggleSpelling}>
              {spellEnabled() ? "✓ " : ""}Check spelling
            </CtxItem>
            <CtxDivider />
            <div className="px-3 pt-0.5 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
              Scene actions
            </div>
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

function CtxItem({
  onClick,
  children,
  shortcut,
}: {
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-1.5 text-left text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
    >
      <span className="truncate">{children}</span>
      {shortcut && (
        <span className="shrink-0 text-[11px] text-[var(--wc-faint)]">{shortcut}</span>
      )}
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
