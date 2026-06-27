import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "card" | "list";

type StoreState = {
  /** Card vs list preference keyed by section (e.g. "projects", "kernels"). */
  byKey: Record<string, ViewMode>;
  set: (key: string, mode: ViewMode) => void;
};

const useStore = create<StoreState>()(
  persist(
    (set) => ({
      byKey: {},
      set: (key, mode) =>
        set((s) => ({ byKey: { ...s.byKey, [key]: mode } })),
    }),
    { name: "wc-view-mode" },
  ),
);

/** Resolve a section's view mode (defaults to "card") and a setter. */
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const mode = useStore((s) => s.byKey[key]) ?? "card";
  const set = useStore((s) => s.set);
  return [mode, (m) => set(key, m)];
}
