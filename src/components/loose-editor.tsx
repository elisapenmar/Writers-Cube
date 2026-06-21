"use client";

import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import {
  updateLooseSceneContent,
  renameLooseScene,
  deleteLooseScene,
  type LooseScene,
} from "@/server/loose";
import { EditorToolbar } from "@/components/editor-toolbar";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function LooseEditor({ scene }: { scene: LooseScene }) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(scene.updated_at);
  const [wordCount, setWordCount] = useState(scene.word_count);
  const [title, setTitle] = useState(scene.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            "prose prose-zinc max-w-3xl mx-auto min-h-[60vh] focus:outline-none font-serif text-lg leading-relaxed",
        },
      },
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setStatus("saving");
        const doc = editor.getJSON();
        saveTimer.current = setTimeout(() => void save(doc), 800);
      },
    },
    [scene.id],
  );

  async function save(doc: unknown) {
    try {
      const r = await updateLooseSceneContent(scene.id, doc);
      setSavedAt(r.savedAt);
      setWordCount(r.word_count);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    const handler = () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        void save(editor.getJSON());
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      handler();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function onTitle(next: string) {
    setTitle(next);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void renameLooseScene(scene.id, next), 600);
  }

  async function remove() {
    if (!confirm("Delete this item?")) return;
    await deleteLooseScene(scene.id);
    router.push("/app/write");
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 h-screen">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 shrink-0">
            Uncategorized
          </span>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Untitled"
            className="font-serif text-lg bg-transparent outline-none min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
          <span className="tabular-nums">{wordCount} words</span>
          <SaveLabel status={status} savedAt={savedAt} />
          <button
            onClick={remove}
            className="rounded-md px-2 py-1 text-zinc-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="border-b border-zinc-200 bg-white px-6 py-1.5">
        <EditorToolbar editor={editor} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-12 bg-zinc-50">
        {editor && <TagBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function SaveLabel({ status, savedAt }: { status: SaveStatus; savedAt: string | null }) {
  if (status === "saving") return <span>Saving…</span>;
  if (status === "error") return <span className="text-red-600">Save failed</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    return (
      <span>
        Saved at {String(d.getHours()).padStart(2, "0")}:
        {String(d.getMinutes()).padStart(2, "0")}
      </span>
    );
  }
  return <span>Not saved yet</span>;
}
