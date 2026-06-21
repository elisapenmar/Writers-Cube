"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { updateSceneContent } from "@/server/scenes";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SceneInput = {
  id: string;
  title: string;
  content: unknown;
};

export function ChapterReader({ scenes }: { scenes: SceneInput[] }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function bumpStatus(s: SaveStatus, t?: string) {
    setStatus(s);
    if (t) setSavedAt(t);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50">
      <div className="sticky top-0 z-10 flex justify-end px-6 py-2 text-xs text-zinc-500 bg-zinc-50/80 backdrop-blur">
        <SaveLabel status={status} savedAt={savedAt} />
      </div>
      <div className="max-w-3xl mx-auto py-8 px-6">
        {scenes.map((scene) => (
          <SceneBlock key={scene.id} scene={scene} onStatus={bumpStatus} />
        ))}
      </div>
    </div>
  );
}

function SceneBlock({
  scene,
  onStatus,
}: {
  scene: SceneInput;
  onStatus: (status: SaveStatus, savedAt?: string) => void;
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
      const result = await updateSceneContent(scene.id, doc);
      onStatus("saved", result.savedAt);
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
    <div className="wc-scene-block">
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
