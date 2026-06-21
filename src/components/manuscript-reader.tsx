"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { updateSceneContent } from "@/server/scenes";
import { updateLooseSceneContent } from "@/server/loose";
import { updateExercise } from "@/server/prompts";
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
};
export type ManuscriptChapter = {
  id: string;
  title: string;
  scenes: ManuscriptScene[];
};

export function ManuscriptReader({
  projectTitle,
  chapters,
  looseScenes = [],
}: {
  projectTitle: string;
  chapters: ManuscriptChapter[];
  looseScenes?: ManuscriptScene[];
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [focusScene, setFocusScene] = useState<ManuscriptScene | null>(null);
  // Per-scene content override + version, so a block remounts with the text it
  // ended up with after a focus session.
  const [override, setOverride] = useState<Record<string, unknown>>({});
  const [version, setVersion] = useState<Record<string, number>>({});

  function bumpStatus(s: SaveStatus, t?: string) {
    setStatus(s);
    if (t) setSavedAt(t);
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
      contentOverride={override[scene.id]}
      onStatus={bumpStatus}
      onFocus={setActiveEditor}
      onRequestFocus={() => setFocusScene(scene)}
    />
  );

  const totalScenes =
    chapters.reduce((n, c) => n + c.scenes.length, 0) + looseScenes.length;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--wc-page)]">
      {/* Sticky toolbar — operates on whichever block is focused */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-6 py-2">
        <span className="font-serif text-sm text-[var(--wc-muted)] shrink-0">
          {projectTitle}
        </span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <EditorToolbar editor={activeEditor} />
        </div>
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
            if (finalDoc) {
              setOverride((o) => ({ ...o, [id]: finalDoc }));
              setVersion((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
            }
            setFocusScene(null);
          }}
        />
      )}
    </div>
  );
}

function SceneBlock({
  scene,
  contentOverride,
  onStatus,
  onFocus,
  onRequestFocus,
}: {
  scene: ManuscriptScene;
  contentOverride?: unknown;
  onStatus: (status: SaveStatus, savedAt?: string) => void;
  onFocus: (editor: Editor) => void;
  onRequestFocus: () => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor(
    {
      extensions: [StarterKit, Underline, ...ALL_TAG_MARKS],
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
      onFocus: ({ editor }) => onFocus(editor),
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

  return (
    <div className="wc-scene-block mb-6 group">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-wider text-[var(--wc-faint)]">
          {scene.title}
        </div>
        <button
          onClick={onRequestFocus}
          className="text-[11px] text-[var(--wc-faint)] opacity-0 group-hover:opacity-100 hover:text-[var(--wc-muted)] transition"
          title="Write this scene in focus mode"
        >
          ✶ Focus
        </button>
      </div>
      {editor && <TagBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
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
