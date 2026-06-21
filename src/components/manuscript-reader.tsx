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

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

  function bumpStatus(s: SaveStatus, t?: string) {
    setStatus(s);
    if (t) setSavedAt(t);
  }

  const totalScenes =
    chapters.reduce((n, c) => n + c.scenes.length, 0) + looseScenes.length;

  return (
    <div className="flex-1 flex flex-col h-screen bg-zinc-50">
      {/* Sticky toolbar — operates on whichever block is focused */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-2">
        <span className="font-serif text-sm text-zinc-700 shrink-0">
          {projectTitle}
        </span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <EditorToolbar editor={activeEditor} />
        </div>
        <span className="shrink-0 text-xs text-zinc-500">
          <SaveLabel status={status} savedAt={savedAt} />
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">
          {totalScenes === 0 && (
            <p className="text-sm text-zinc-500 text-center py-16">
              Nothing to scroll yet — add chapters and scenes from the sidebar.
            </p>
          )}
          {chapters.map((chapter) => (
            <section key={chapter.id} className="mb-10">
              <h2 className="font-serif text-2xl text-zinc-800 mb-4 pb-1 border-b border-zinc-200">
                {chapter.title}
              </h2>
              {chapter.scenes.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">No scenes yet.</p>
              ) : (
                chapter.scenes.map((scene) => (
                  <SceneBlock
                    key={scene.id}
                    scene={scene}
                    onStatus={bumpStatus}
                    onFocus={setActiveEditor}
                  />
                ))
              )}
            </section>
          ))}

          {looseScenes.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-2xl text-zinc-800 mb-4 pb-1 border-b border-zinc-200">
                Uncategorized
              </h2>
              {looseScenes.map((scene) => (
                <SceneBlock
                  key={scene.id}
                  scene={scene}
                  onStatus={bumpStatus}
                  onFocus={setActiveEditor}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SceneBlock({
  scene,
  onStatus,
  onFocus,
}: {
  scene: ManuscriptScene;
  onStatus: (status: SaveStatus, savedAt?: string) => void;
  onFocus: (editor: Editor) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor(
    {
      extensions: [StarterKit, Underline, ...ALL_TAG_MARKS],
      content: (scene.content as object | null) ?? {
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
    <div className="wc-scene-block mb-6">
      <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
        {scene.title}
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
