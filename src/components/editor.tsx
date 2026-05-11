"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/types";
import { updateSceneContent } from "@/server/scenes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function Editor({ scene }: { scene: Scene }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(scene.updated_at);
  const [wordCount, setWordCount] = useState<number>(scene.word_count);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: (scene.content as object | null) ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc max-w-3xl mx-auto min-h-[60vh] focus:outline-none font-serif text-lg leading-relaxed",
        },
      },
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setStatus("saving");
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
      setSavedAt(result.savedAt);
      setWordCount(result.word_count);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  // Flush on unmount / scene switch.
  useEffect(() => {
    return () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        void save(editor.getJSON());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

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
    <div className="flex flex-col flex-1 h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <h2 className="font-serif text-lg">{scene.title}</h2>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{wordCount} words</span>
          <SaveLabel status={status} savedAt={savedAt} />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-12 bg-zinc-50">
        <EditorContent editor={editor} />
      </div>
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
