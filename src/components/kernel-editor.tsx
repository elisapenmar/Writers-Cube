"use client";

import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Indent } from "@/lib/indent";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateKernel } from "@/server/kernels";
import { createProjectFromContent } from "@/server/projects";
import { EditorToolbar } from "@/components/editor-toolbar";

type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function KernelEditor({
  id,
  initialTitle,
  initialContent,
}: {
  id: string;
  initialTitle: string;
  initialContent: unknown;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [save, setSave] = useState<SaveState>("idle");
  const [promoting, startPromote] = useTransition();
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Indent, TextStyle, FontFamily],
    content: (initialContent as object | null) ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed min-h-[50vh]",
      },
    },
    onUpdate: ({ editor }) => {
      if (contentTimer.current) clearTimeout(contentTimer.current);
      setSave("saving");
      const doc = editor.getJSON();
      contentTimer.current = setTimeout(async () => {
        try {
          await updateKernel(id, { content: doc });
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
        void updateKernel(id, { content: editor.getJSON() });
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
        await updateKernel(id, { title: next });
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 600);
  }

  function turnIntoProject() {
    if (!editor) return;
    const doc = editor.getJSON();
    startPromote(async () => {
      try {
        await updateKernel(id, { content: doc });
        await createProjectFromContent(title || "Untitled", doc);
        router.push("/app/manuscript");
        router.refresh();
      } catch {
        setSave("error");
      }
    });
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled kernel"
        className="w-full bg-transparent font-serif text-2xl text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)] mb-1"
      />
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--wc-faint)] mb-4">
        <SaveLabel state={save} />
        <button
          onClick={turnIntoProject}
          disabled={promoting}
          className="rounded-md px-3 py-1.5 text-xs text-[var(--wc-on-accent)] transition hover:brightness-105 disabled:opacity-50"
          style={{ background: "var(--wc-slate)" }}
          title="Start a new project seeded with this kernel"
        >
          {promoting ? "Creating…" : "✦ Turn into project"}
        </button>
      </div>

      <div className="sticky top-0 z-10 bg-[var(--wc-cream)] py-1.5 border-b border-[var(--wc-border)] mb-3">
        <EditorToolbar editor={editor} />
      </div>
      <div className="rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6">
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
