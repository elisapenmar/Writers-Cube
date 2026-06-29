"use client";

import { create } from "zustand";
import type { Editor as TiptapEditor } from "@tiptap/react";

/**
 * Editor bridge: the A∩B boundary for the mobile toolbar.
 *
 * Agent B (mobile UI) renders a touch-friendly toolbar that must drive whatever
 * editor is on screen, but Agent B does NOT edit `editor.tsx` internals. So the
 * contract is a registry: whichever editor variant is mounted (`editor.tsx`,
 * `loose-editor.tsx`, `exercise-editor.tsx`, `kernel-editor.tsx`) registers its
 * active Tiptap `Editor` instance here on mount and clears it on unmount. The
 * mobile toolbar subscribes and renders against the current instance.
 *
 * EXPECTED FROM AGENT A (editor.tsx and the other editor variants): one line in
 * the mount/unmount effect, e.g.
 *
 *     useEffect(() => {
 *       if (!editor) return;
 *       registerActiveEditor(editor);
 *       return () => clearActiveEditor(editor);
 *     }, [editor]);
 *
 * `clearActiveEditor(editor)` only clears if the passed instance is still the
 * registered one, so a remount race (new editor registers before the old one's
 * cleanup runs) cannot blank a live editor.
 *
 * Until A wires that in, the bridge stays empty and the mobile toolbar simply
 * renders disabled. The Tiptap `Editor` shape is the same one `editor-toolbar`
 * already consumes, so no new command surface is invented here.
 */
type EditorBridgeState = {
  editor: TiptapEditor | null;
  setEditor: (editor: TiptapEditor | null) => void;
};

export const useEditorBridge = create<EditorBridgeState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
}));

/** Register the active editor instance. Call from an editor variant on mount. */
export function registerActiveEditor(editor: TiptapEditor): void {
  useEditorBridge.getState().setEditor(editor);
}

/** Clear the active editor, but only if `editor` is still the registered one
 *  (guards against a remount registering the new editor before the old one's
 *  cleanup fires). */
export function clearActiveEditor(editor: TiptapEditor): void {
  const state = useEditorBridge.getState();
  if (state.editor === editor) state.setEditor(null);
}

/** Hook for consumers (the mobile toolbar) to read the active editor. */
export function useActiveEditor(): TiptapEditor | null {
  return useEditorBridge((s) => s.editor);
}
