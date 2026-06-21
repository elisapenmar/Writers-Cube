"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CustomTagDef = { id: string; label: string; color: string };

// Soft, muted palette to cycle through for new custom tags.
const PALETTE = [
  "#8a7a96", // mauve
  "#5d7384", // slate
  "#8aa791", // sage
  "#c07a63", // clay
  "#cdab6b", // gold
  "#7f8aa6", // periwinkle
  "#a3786f", // taupe
];

type State = {
  tags: CustomTagDef[];
  add: (label: string) => CustomTagDef | null;
  remove: (id: string) => void;
};

export const useCustomTags = create<State>()(
  persist(
    (set, get) => ({
      tags: [],
      add: (label) => {
        const trimmed = label.trim().slice(0, 40);
        if (!trimmed) return null;
        const existing = get().tags.find(
          (t) => t.label.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) return existing;
        const color = PALETTE[get().tags.length % PALETTE.length];
        const def: CustomTagDef = {
          id: `ct-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          label: trimmed,
          color,
        };
        set((s) => ({ tags: [...s.tags, def] }));
        return def;
      },
      remove: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),
    }),
    { name: "wc-custom-tags" },
  ),
);
