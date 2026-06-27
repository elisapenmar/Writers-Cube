import { create } from "zustand";
import { persist } from "zustand/middleware";
import { asForm } from "@/lib/project-forms";

export type PageFormat = "pageless" | "paged";

type ViewValues = {
  /** "pageless" = responsive full width; "paged" = a fixed 8.5in sheet. */
  pageFormat: PageFormat;
  /** Line height multiplier: 1, 1.15, 1.5, 2. */
  lineSpacing: number;
  spaceBefore: boolean;
  spaceAfter: boolean;
  /** Column count: 1, 2, or 3. */
  columns: number;
};

export type EditorView = ViewValues & {
  setPageFormat: (v: PageFormat) => void;
  setLineSpacing: (v: number) => void;
  setSpaceBefore: (v: boolean) => void;
  setSpaceAfter: (v: boolean) => void;
  setColumns: (v: number) => void;
};

/** Per-form defaults: novels read as a continuous manuscript (pageless);
 *  every other form reads as discrete pages (paged), single piece at a time. */
function defaultsFor(form?: string): ViewValues {
  const paged = asForm(form) !== "novel";
  return {
    pageFormat: paged ? "paged" : "pageless",
    lineSpacing: 1.5,
    spaceBefore: false,
    spaceAfter: false,
    columns: 1,
  };
}

type StoreState = {
  /** User overrides keyed by project id; missing keys fall back to form defaults. */
  byProject: Record<string, Partial<ViewValues>>;
  patch: (projectId: string, p: Partial<ViewValues>) => void;
};

const useStore = create<StoreState>()(
  persist(
    (set) => ({
      byProject: {},
      patch: (projectId, p) =>
        set((s) => ({
          byProject: {
            ...s.byProject,
            [projectId]: { ...(s.byProject[projectId] ?? {}), ...p },
          },
        })),
    }),
    { name: "wc-editor-view-v2" },
  ),
);

/**
 * Resolve the view settings for a project: form-based defaults overlaid with any
 * per-project user choices. Pass no project to get the global ("_global") view.
 */
export function useEditorView(projectId = "_global", form?: string): EditorView {
  const saved = useStore((s) => s.byProject[projectId]);
  const patch = useStore((s) => s.patch);
  const v = { ...defaultsFor(form), ...(saved ?? {}) };
  return {
    ...v,
    setPageFormat: (pageFormat) => patch(projectId, { pageFormat }),
    setLineSpacing: (lineSpacing) => patch(projectId, { lineSpacing }),
    setSpaceBefore: (spaceBefore) => patch(projectId, { spaceBefore }),
    setSpaceAfter: (spaceAfter) => patch(projectId, { spaceAfter }),
    setColumns: (columns) => patch(projectId, { columns }),
  };
}
