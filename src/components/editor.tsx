"use client";

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Scene } from "@/lib/types";
import { updateSceneContent, splitScene, splitSceneAt, mergeScene } from "@/server/scenes";
import { RTE_EXTENSIONS } from "@/lib/editor-extensions";
import { useSceneCollab } from "@/lib/yjs/use-collab";
import { TypewriterMode } from "@/components/typewriter-mode";
import { EditorToolbar } from "@/components/editor-toolbar";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";
import { PageRuler, PageRulerV } from "@/components/page-ruler";
import { ZoomSelect } from "@/components/zoom-select";
import { SceneHistory } from "@/components/scene-history";
import { FindReplace } from "@/components/find-replace";
import { EditorViewOptions } from "@/components/editor-view-options";
import { useEditorView } from "@/store/editor-view-store";
import { lookupMisspelling, acceptWord, spellEnabled, setSpellEnabled, type SpellHit } from "@/lib/spellcheck";
import { useClampedMenuPosition } from "@/lib/menu-position";
import { AiDiamond } from "@/components/icons";
import { startOutbox, registerOutboxHandlers, useOnReconnect } from "@/lib/offline";
import { registerActiveEditor, clearActiveEditor } from "@/lib/editor-bridge";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Headless hooks for Agent B's mobile toolbar/shell. The editor owns its Tiptap
 * instance; Agent B renders chrome around it WITHOUT editing this file's
 * internals:
 *
 * - `onEditorReady(editor)` hands B the live Tiptap editor (or null on unmount)
 *   so a mobile toolbar can run commands (`editor.chain().focus()...`) and read
 *   `editor.isActive(...)` for active-state styling. B builds its own toolbar
 *   component against this instance.
 * - `renderToolbar(editor)` lets B inject a replacement toolbar in the toolbar
 *   slot (e.g. a touch-friendly bar). When omitted, the default EditorToolbar
 *   renders, so desktop is unchanged.
 *
 * Sync state is consumed separately via `useSyncState()` from "@/lib/offline";
 * B can render that indicator anywhere in its shell.
 */
export type EditorProps = {
  scene: Scene;
  onEditorReady?: (editor: TiptapEditor | null) => void;
  renderToolbar?: (editor: TiptapEditor | null) => React.ReactNode;
};

export function Editor({ scene, onEditorReady, renderToolbar }: EditorProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(scene.updated_at);
  const [wordCount, setWordCount] = useState<number>(scene.word_count);
  const [typewriterOpen, setTypewriterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockIndex: number; pos: number; spell?: SpellHit | null } | null>(null);
  const menuRef = useClampedMenuPosition(ctxMenu?.x ?? null, ctxMenu?.y ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CAS version token: the `updated_at` we last persisted/loaded. Sent as the
  // base on each save so concurrent writers are detected, not silently clobbered.
  const baseUpdatedAt = useRef<string | null>(scene.updated_at);
  const router = useRouter();
  const view = useEditorView();

  // Live co-editing (flag-gated). When ready, the Y.Doc is the source of truth
  // and Collaboration owns content/history; otherwise the classic blob editor.
  const collab = useSceneCollab(scene.id);
  const collabReady = collab.mode === "ready";

  // Seed a fresh (never-edited) shared doc from the existing scene blob. Only the
  // client that won the server seed-claim does this, so a simultaneous cold open
  // can't duplicate the content.
  function seedCollabDoc(ed: TiptapEditor) {
    if (collab.mode !== "ready" || !collab.shouldSeed) return;
    const doc = collab.provider.doc;
    const meta = doc.getMap("meta");
    if (meta.get("seeded")) return;
    const frag = doc.getXmlFragment("default");
    const blob = scene.content as object | null;
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
        : (scene.content as object | null) ?? {
            type: "doc",
            content: [{ type: "paragraph" }],
          },
      editable: collab.mode !== "loading",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          // Width / line-spacing / columns are controlled by the page wrapper.
          class: "prose prose-zinc max-w-none min-h-[60vh] focus:outline-none font-serif text-lg",
        },
      },
      onCreate: collabReady ? ({ editor }) => seedCollabDoc(editor) : undefined,
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setStatus("saving");
        const doc = editor.getJSON();
        saveTimer.current = setTimeout(() => {
          void save(doc);
        }, 800);
      },
    },
    [scene.id, collabReady],
  );

  async function save(doc: unknown) {
    try {
      const result = await updateSceneContent(scene.id, doc, baseUpdatedAt.current);
      baseUpdatedAt.current = result.savedAt;
      saveFailed.current = false;
      setSavedAt(result.savedAt);
      setWordCount(result.word_count);
      setStatus("saved");
    } catch {
      saveFailed.current = true;
      setStatus("error");
    }
  }

  // Offline typing keeps prose in the local Yjs mirror, but the durable JSONB
  // save above fails with no network — retry it the moment connectivity
  // returns, otherwise the server (and desktop web) holds stale content until
  // the writer happens to type again.
  const saveFailed = useRef(false);
  useOnReconnect(() => {
    if (saveFailed.current && editor && !editor.isDestroyed) {
      setStatus("saving");
      void save(editor.getJSON());
    }
  });

  async function doSplit(into: "scenes" | "chapters") {
    setSplitting(true);
    setSplitMsg(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor) await save(editor.getJSON());
      const { created, firstContent } = await splitScene(scene.id, into);
      if (editor && firstContent) {
        editor.commands.setContent(firstContent as object, { emitUpdate: false });
        setWordCount(countWords(firstContent));
      }
      setSplitOpen(false);
      setSplitMsg(
        `Split into ${created + 1} ${into === "scenes" ? "scenes" : "chapters"}.`,
      );
      router.refresh();
    } catch (e) {
      setSplitMsg(e instanceof Error ? e.message : "Split failed");
    } finally {
      setSplitting(false);
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    if (!editor) return;
    e.preventDefault();
    // posAtCoords is null when clicking past the end of a line, fall back to
    // the caret position so the menu always opens.
    const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const pos = coords?.pos ?? editor.state.selection.from;
    const index = editor.state.doc.resolve(pos).index(0);
    const spell = lookupMisspelling(editor, pos);
    setCtxMenu({ x: e.clientX, y: e.clientY, blockIndex: index, pos, spell });
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

  function openMenuFromButton(e: React.MouseEvent) {
    if (!editor) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = editor.state.selection.from;
    const index = editor.state.doc.resolve(pos).index(0);
    setCtxMenu({ x: rect.right, y: rect.bottom, blockIndex: index, pos });
  }

  function insertFootnoteHere() {
    const pos = ctxMenu?.pos;
    setCtxMenu(null);
    if (!editor) return;
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
      /* clipboard blocked — Cmd/Ctrl-V still works */
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

  async function doMerge(direction: "previous" | "next") {
    setCtxMenu(null);
    setSplitMsg(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor) await save(editor.getJSON());
      const { sceneId } = await mergeScene(scene.id, direction);
      router.push(`/app/scene/${sceneId}`);
      router.refresh();
    } catch (err) {
      setSplitMsg(err instanceof Error ? err.message : "Merge failed");
    }
  }

  async function doSplitAt(into: "scenes" | "chapters") {
    if (!ctxMenu) return;
    const blockIndex = ctxMenu.blockIndex;
    setCtxMenu(null);
    setSplitting(true);
    setSplitMsg(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor) await save(editor.getJSON());
      const { firstContent } = await splitSceneAt(scene.id, blockIndex, into);
      if (editor && firstContent) {
        editor.commands.setContent(firstContent as object, { emitUpdate: false });
        setWordCount(countWords(firstContent));
      }
      setSplitMsg(
        into === "scenes" ? "Split into a new scene here." : "Split into a new chapter here.",
      );
      router.refresh();
    } catch (err) {
      setSplitMsg(err instanceof Error ? err.message : "Split failed");
    } finally {
      setSplitting(false);
    }
  }

  // Flush on unmount / scene switch.
  useEffect(() => {
    // New scene loaded: reset the CAS token to this scene's version.
    baseUpdatedAt.current = scene.updated_at;
    return () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        void save(editor.getJSON());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // Offline/sync layer: register the structural-mutation replay handlers and
  // wire the outbox to connectivity once. Both are idempotent, so mounting the
  // editor (the most common writing surface) is a safe place to kick it off.
  useEffect(() => {
    registerOutboxHandlers();
    const stop = startOutbox();
    return stop;
  }, []);

  // Hand the live editor to the mobile toolbar/shell: both the optional prop and
  // the global editor bridge (which the fixed mobile formatting bar reads), then
  // clear both on unmount.
  useEffect(() => {
    onEditorReady?.(editor);
    if (editor) registerActiveEditor(editor);
    return () => {
      onEditorReady?.(null);
      if (editor) clearActiveEditor(editor);
    };
  }, [editor, onEditorReady]);

  // ⌘F / Ctrl-F opens find & replace.
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

  // Flush before navigating away or closing the tab.
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

  return (
    <div className="relative flex flex-col flex-1 h-screen">
      {findOpen && editor && (
        <FindReplace editor={editor} onClose={() => setFindOpen(false)} />
      )}
      <header className="wc-desktop-toolbar flex items-center justify-between border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-6 py-3">
        <h2 className="font-serif text-lg truncate">{scene.title}</h2>
        <div className="flex items-center gap-3 text-xs text-[var(--wc-faint)] shrink-0">
          <span className="tabular-nums">{wordCount} words</span>
          <span className="text-[var(--wc-faint)]">·</span>
          <SaveLabel status={status} savedAt={savedAt} />
          <div className="relative">
            <button
              onClick={() => setSplitOpen((o) => !o)}
              disabled={splitting}
              className="flex items-center gap-1 rounded-md border border-[var(--wc-border-strong)] px-3 py-1 hover:bg-[var(--wc-canvas)] text-[var(--wc-ink)] disabled:opacity-50"
              title="Split this scene's text into multiple scenes or chapters"
            >
              <AiDiamond className="text-[var(--wc-slate)]" />
              {splitting ? "Splitting…" : "Split"}
            </button>
            {splitOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSplitOpen(false)} />
                <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 text-left shadow-xl">
                  <button
                    onClick={() => doSplit("scenes")}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--wc-canvas)]"
                  >
                    <div className="text-sm text-[var(--wc-ink)]">Into scenes</div>
                    <div className="text-[11px] text-[var(--wc-faint)]">
                      Breaks where a line is just <span className="font-mono">* * *</span>
                    </div>
                  </button>
                  <button
                    onClick={() => doSplit("chapters")}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--wc-canvas)]"
                  >
                    <div className="text-sm text-[var(--wc-ink)]">Into chapters</div>
                    <div className="text-[11px] text-[var(--wc-faint)]">
                      Breaks at headings or <span className="font-mono"># </span>lines
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setFindOpen(true)}
            className="rounded-md border border-[var(--wc-border-strong)] px-3 py-1 hover:bg-[var(--wc-canvas)] text-[var(--wc-ink)]"
            title="Find & replace (⌘F)"
          >
            Find
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="rounded-md border border-[var(--wc-border-strong)] px-3 py-1 hover:bg-[var(--wc-canvas)] text-[var(--wc-ink)]"
            title="Version history"
          >
            History
          </button>
          <button
            onClick={openMenuFromButton}
            className="rounded-md border border-[var(--wc-border-strong)] px-2.5 py-1 hover:bg-[var(--wc-canvas)] text-[var(--wc-ink)]"
            title="Scene actions: split here, merge, scene break (also on right-click)"
          >
            ⋯
          </button>
          <EditorViewOptions view={view} />
          <ZoomSelect view={view} />
          <button
            onClick={() => setTypewriterOpen(true)}
            className="rounded-md border border-[var(--wc-border-strong)] px-3 py-1 hover:bg-[var(--wc-canvas)] text-[var(--wc-muted)]"
            title="Enter focused, distraction-free writing"
          >
            Focus mode
          </button>
        </div>
      </header>
      {splitMsg && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-800">
          {splitMsg}
        </div>
      )}

      <div className="wc-desktop-toolbar border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-6 py-1.5">
        {renderToolbar ? renderToolbar(editor) : <EditorToolbar editor={editor} view={view} />}
      </div>

      {typewriterOpen && (
        <TypewriterMode
          scene={{
            id: scene.id,
            title: scene.title,
            content: editor ? editor.getJSON() : scene.content,
            word_count: wordCount,
          }}
          onExit={(finalDoc, finalWordCount) => {
            setTypewriterOpen(false);
            if (finalDoc && editor) {
              editor.commands.setContent(finalDoc as object, { emitUpdate: false });
            }
            if (typeof finalWordCount === "number") {
              setWordCount(finalWordCount);
            }
            setSavedAt(new Date().toISOString());
            setStatus("saved");
          }}
        />
      )}
      <div
        className="flex-1 overflow-auto px-4 sm:px-8 py-10 bg-[var(--wc-page)]"
        onContextMenu={onContextMenu}
      >
        {editor && <TagBubbleMenu editor={editor} />}
        {view.pageFormat === "paged" ? (
          <div className="wc-page-zoom" style={{ zoom: view.pageZoom } as React.CSSProperties}>
            <PageRuler view={view} />
            <div className="wc-page-rel">
              <PageRulerV view={view} />
              <div
                className="wc-doc wc-doc-paged"
                data-paged="true"
                data-margin-top={view.marginTop}
                data-margin-bottom={view.marginBottom}
                data-space-before={view.spaceBefore}
                data-space-after={view.spaceAfter}
                style={
                  {
                    "--wc-line": String(view.lineSpacing),
                    "--wc-margin-l": `${view.marginLeft}in`,
                    "--wc-margin-r": `${view.marginRight}in`,
                    "--wc-margin-t": `${view.marginTop}in`,
                    "--wc-margin-b": `${view.marginBottom}in`,
                  } as React.CSSProperties
                }
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="wc-doc wc-doc-pageless"
            data-space-before={view.spaceBefore}
            data-space-after={view.spaceAfter}
            style={{ "--wc-line": String(view.lineSpacing) } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div
            ref={menuRef}
            className="fixed z-50 w-60 max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-sm shadow-xl"
          >
            {ctxMenu.spell && (
              <>
                {ctxMenu.spell.suggestions.length > 0 ? (
                  ctxMenu.spell.suggestions.map((s) => (
                    <MenuItem key={s} onClick={() => applySuggestion(ctxMenu.spell!, s)}>
                      <span className="font-medium text-[var(--wc-ink)]">{s}</span>
                    </MenuItem>
                  ))
                ) : (
                  <div className="px-3 py-1.5 text-xs text-[var(--wc-faint)]">No suggestions</div>
                )}
                <MenuItem onClick={() => addToDictionary(ctxMenu.spell!.word)}>
                  ＋ Add “{ctxMenu.spell.word}” to dictionary
                </MenuItem>
                <div className="my-1 border-t border-[var(--wc-border)]" />
              </>
            )}
            <MenuItem onClick={doCut} shortcut="⌘X">Cut</MenuItem>
            <MenuItem onClick={doCopy} shortcut="⌘C">Copy</MenuItem>
            <MenuItem onClick={doPaste} shortcut="⌘V">Paste</MenuItem>
            <MenuItem onClick={selectAll} shortcut="⌘A">Select all</MenuItem>
            <div className="my-1 border-t border-[var(--wc-border)]" />
            <MenuItem onClick={editLink} shortcut="⌘K">Insert / edit link</MenuItem>
            <MenuItem onClick={insertFootnoteHere}>Insert footnote here</MenuItem>
            <MenuItem onClick={clearFormatting}>Clear formatting</MenuItem>
            <MenuItem onClick={toggleSpelling}>
              {spellEnabled() ? "✓ " : ""}Check spelling
            </MenuItem>
            <div className="my-1 border-t border-[var(--wc-border)]" />
            <div className="px-3 pt-0.5 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
              Scene actions
            </div>
            <MenuItem onClick={() => doSplitAt("scenes")}>✂ Split into a new scene here</MenuItem>
            <MenuItem onClick={() => doSplitAt("chapters")}>✂ Split into a new chapter here</MenuItem>
            <div className="my-1 border-t border-[var(--wc-border)]" />
            <MenuItem onClick={() => doMerge("previous")}>⇡ Merge with previous scene</MenuItem>
            <MenuItem onClick={() => doMerge("next")}>⇣ Merge with next scene</MenuItem>
          </div>
        </>
      )}

      {historyOpen && (
        <SceneHistory
          sceneId={scene.id}
          sceneTitle={scene.title}
          onClose={() => setHistoryOpen(false)}
          onRestore={(content) => {
            if (editor) {
              editor.commands.setContent(content as object, { emitUpdate: false });
              setWordCount(countWords(content));
              setSavedAt(new Date().toISOString());
              setStatus("saved");
            }
          }}
        />
      )}
    </div>
  );
}

function MenuItem({
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

function SaveLabel({
  status,
  savedAt,
}: {
  status: SaveStatus;
  savedAt: string | null;
}) {
  if (status === "saving") return <span>Saving…</span>;
  if (status === "error")
    return <span className="text-red-600">Save failed</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return <span>Saved at {hh}:{mm}</span>;
  }
  return <span>Not saved yet</span>;
}
