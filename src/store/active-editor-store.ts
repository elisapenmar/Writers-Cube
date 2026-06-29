"use client";

// A thin bridge so docked panels (which render without props) can reach the
// editor that's currently on screen: read the selected word for the language
// sidebar, and insert a poetic-form scaffold from the Forms tab. The editor
// publishes itself here on mount and clears it on unmount; panels subscribe.
//
// Only one editor is on screen at a time in the writing view, so a single slot
// is enough. State is in-memory UI glue, never persisted.

import { create } from "zustand";
import type { Editor } from "@tiptap/react";

type ActiveEditorState = {
  editor: Editor | null;
  /** The word under/around the current selection, kept in sync by the editor. */
  selectedWord: string;
  setEditor: (editor: Editor | null) => void;
  setSelectedWord: (word: string) => void;
};

export const useActiveEditor = create<ActiveEditorState>((set) => ({
  editor: null,
  selectedWord: "",
  setEditor: (editor) => set({ editor }),
  setSelectedWord: (selectedWord) => set({ selectedWord }),
}));

/** Insert verse lines at the current selection, each as its own hard line.
 *  Empty strings become blank lines (stanza breaks). Returns false if no editor
 *  is active. */
export function insertVerseScaffold(lines: string[]): boolean {
  const editor = useActiveEditor.getState().editor;
  if (!editor) return false;
  // Build a single paragraph with hardBreaks between lines, matching how verse
  // mode stores poems (one paragraph, line breaks inside).
  const content = lines.flatMap((line, i) => {
    const node: Record<string, unknown>[] = [];
    if (i > 0) node.push({ type: "hardBreak" });
    if (line) node.push({ type: "text", text: line });
    return node;
  });
  editor
    .chain()
    .focus()
    .insertContent({ type: "paragraph", content })
    .run();
  return true;
}
