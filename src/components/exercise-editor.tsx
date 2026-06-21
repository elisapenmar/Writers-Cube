"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { updateExercise } from "@/server/prompts";
import { EditorToolbar } from "@/components/editor-toolbar";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";

type SaveState = "idle" | "saving" | "saved" | "error";

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

export function ExerciseEditor({
  id,
  initialTitle,
  initialContent,
  promptText,
}: {
  id: string;
  initialTitle: string;
  initialContent: unknown;
  promptText: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [save, setSave] = useState<SaveState>("idle");
  const [words, setWords] = useState(() => countWords(initialContent));
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, ...ALL_TAG_MARKS],
    content:
      (initialContent as object | null) ?? { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed min-h-[40vh]",
      },
    },
    onUpdate: ({ editor }) => {
      if (contentTimer.current) clearTimeout(contentTimer.current);
      setSave("saving");
      const doc = editor.getJSON();
      setWords(countWords(doc));
      contentTimer.current = setTimeout(async () => {
        try {
          await updateExercise(id, { content: doc, wordCount: countWords(doc) });
          setSave("saved");
        } catch {
          setSave("error");
        }
      }, 700);
    },
  });

  // Flush content on unload.
  useEffect(() => {
    const handler = () => {
      if (contentTimer.current && editor) {
        clearTimeout(contentTimer.current);
        const doc = editor.getJSON();
        void updateExercise(id, { content: doc, wordCount: countWords(doc) });
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      handler();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function onTitleChange(next: string) {
    setTitle(next);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    setSave("saving");
    titleTimer.current = setTimeout(async () => {
      try {
        await updateExercise(id, { title: next });
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 600);
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled exercise"
        className="w-full bg-transparent font-serif text-2xl text-[var(--wc-ink)] outline-none placeholder:text-zinc-300 mb-1"
      />
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
        <span className="tabular-nums">{words} words</span>
        <span className="text-zinc-300">·</span>
        <SaveLabel state={save} />
      </div>

      {/* Prompt reference */}
      <div className="rounded-2xl wc-paper border border-[rgba(33,31,41,0.08)] p-4 mb-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
          The prompt
        </div>
        <p className="font-serif text-base text-zinc-700 leading-relaxed">
          {promptText}
        </p>
      </div>

      {/* Editable continuation */}
      <div className="sticky top-0 z-10 bg-[var(--wc-cream)] py-1.5 border-b border-zinc-200 mb-3">
        <EditorToolbar editor={editor} />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        {editor && <TagBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function SaveLabel({ state }: { state: SaveState }) {
  if (state === "saving") return <span>Saving…</span>;
  if (state === "error") return <span className="text-red-600">Save failed</span>;
  if (state === "saved") return <span>Saved</span>;
  return <span>&nbsp;</span>;
}
