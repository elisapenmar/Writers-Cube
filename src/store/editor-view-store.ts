import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PageFormat = "pageless" | "paged";

type EditorViewState = {
  /** "pageless" = responsive full width; "paged" = a fixed 8.5in sheet. */
  pageFormat: PageFormat;
  /** Line height multiplier: 1, 1.15, 1.5, 2. */
  lineSpacing: number;
  spaceBefore: boolean;
  spaceAfter: boolean;
  /** Column count: 1, 2, or 3. */
  columns: number;
  setPageFormat: (v: PageFormat) => void;
  setLineSpacing: (v: number) => void;
  setSpaceBefore: (v: boolean) => void;
  setSpaceAfter: (v: boolean) => void;
  setColumns: (v: number) => void;
};

export const useEditorView = create<EditorViewState>()(
  persist(
    (set) => ({
      pageFormat: "pageless",
      lineSpacing: 1.5,
      spaceBefore: false,
      spaceAfter: false,
      columns: 1,
      setPageFormat: (pageFormat) => set({ pageFormat }),
      setLineSpacing: (lineSpacing) => set({ lineSpacing }),
      setSpaceBefore: (spaceBefore) => set({ spaceBefore }),
      setSpaceAfter: (spaceAfter) => set({ spaceAfter }),
      setColumns: (columns) => set({ columns }),
    }),
    { name: "wc-editor-view" },
  ),
);
