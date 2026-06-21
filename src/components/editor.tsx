"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Scene } from "@/lib/types";
import { updateSceneContent, splitScene } from "@/server/scenes";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { TypewriterMode } from "@/components/typewriter-mode";
import { EditorToolbar } from "@/components/editor-toolbar";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function Editor({ scene }: { scene: Scene }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(scene.updated_at);
  const [wordCount, setWordCount] = useState<number>(scene.word_count);
  const [typewriterOpen, setTypewriterOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

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
        <h2 className="font-serif text-lg truncate">{scene.title}</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
          <span className="tabular-nums">{wordCount} words</span>
          <span className="text-zinc-300">·</span>
          <SaveLabel status={status} savedAt={savedAt} />
          <div className="relative">
            <button
              onClick={() => setSplitOpen((o) => !o)}
              disabled={splitting}
              className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 text-zinc-700 disabled:opacity-50"
              title="Split this scene's text into multiple scenes or chapters"
            >
              {splitting ? "Splitting…" : "Split"}
            </button>
            {splitOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSplitOpen(false)} />
                <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-1.5 text-left shadow-xl">
                  <button
                    onClick={() => doSplit("scenes")}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-zinc-50"
                  >
                    <div className="text-sm text-zinc-800">Into scenes</div>
                    <div className="text-[11px] text-zinc-400">
                      Breaks where a line is just <span className="font-mono">* * *</span>
                    </div>
                  </button>
                  <button
                    onClick={() => doSplit("chapters")}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-zinc-50"
                  >
                    <div className="text-sm text-zinc-800">Into chapters</div>
                    <div className="text-[11px] text-zinc-400">
                      Breaks at headings or <span className="font-mono"># </span>lines
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setTypewriterOpen(true)}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 text-zinc-700"
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

      <div className="border-b border-zinc-200 bg-white px-6 py-1.5">
        <EditorToolbar editor={editor} />
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
      <div className="flex-1 overflow-y-auto px-6 py-12 bg-zinc-50">
        {editor && <TagBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
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
