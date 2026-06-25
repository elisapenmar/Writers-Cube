"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MindMapNode, OrganizeFormat as BrainstormFormat } from "@/server/brainstorm";
import type { SavedPosition } from "@/server/mindmap";

export type OrganizeFormat =
  | BrainstormFormat
  | "outline"
  | "characters"
  | "canvas"
  | "timeline"
  | "tags";

export type PanelGroup = "organize" | "bible" | "tags";

export const GROUP_TABS: Record<PanelGroup, OrganizeFormat[]> = {
  organize: ["notes", "canvas"],
  bible: ["mindmap", "outline", "characters", "timeline"],
  tags: ["tags"],
};

export const GROUP_LABEL: Record<PanelGroup, string> = {
  organize: "Organize",
  bible: "Story Bible",
  tags: "Tags",
};

const DEFAULT_PINNED_WIDTH = 480;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 1000;

type OrganizeState = {
  /** Width of the panel in pixels (applies in both pinned and floating modes). */
  panelWidth: number;
  setPanelWidth: (n: number) => void;

  /** Notes are the source of truth — server-persisted and user-editable.
   *  `notes` is the value currently shown; updated on save. */
  notes: string;
  /** Whether we've fetched notes from the server at least once this tab. */
  notesHydrated: boolean;
  /** Local "dirty" notes — the unsaved edit buffer (autosaves to server). */
  notesDraft: string;
  notesSaving: boolean;
  notesSavedAt: string | null;

  nodes: MindMapNode[] | null;
  /** Manually-saved positions for nodes; the rest auto-layout. */
  positions: Record<string, SavedPosition>;
  /** Have we loaded the saved mind map from the DB yet (this tab)? */
  mindMapHydrated: boolean;
  format: OrganizeFormat;
  /** Which entry the right panel was opened as. */
  panelGroup: PanelGroup;
  openGroup: (group: PanelGroup) => void;
  open: boolean;
  pinned: boolean;
  /** Selected brainstorm id for the brainstorm side panel. null → load the latest. */
  currentBrainstormId: string | null;
  setCurrentBrainstormId: (id: string | null) => void;

  /** Brainstorm panel (left side, separate from Organize). */
  bsOpen: boolean;
  bsPinned: boolean;
  bsWidth: number;
  setBsOpen: (b: boolean) => void;
  toggleBsPin: () => void;
  setBsWidth: (n: number) => void;

  /** Main side-nav collapse state (the chapters/scenes column). */
  navCollapsed: boolean;
  toggleNavCollapsed: () => void;
  organizing: boolean;
  error: string | null;

  setNotes: (text: string) => void;
  setNotesDraft: (text: string) => void;
  setNotesSaving: (b: boolean) => void;
  setNotesSavedAt: (s: string | null) => void;
  markNotesHydrated: () => void;
  setNodes: (nodes: MindMapNode[] | null) => void;
  setPositions: (positions: Record<string, SavedPosition>) => void;
  setMindMapHydrated: (b: boolean) => void;
  setFormat: (f: OrganizeFormat) => void;
  setOpen: (b: boolean) => void;
  togglePin: () => void;
  setOrganizing: (b: boolean) => void;
  setError: (s: string | null) => void;
  reset: () => void;
};

export const useOrganize = create<OrganizeState>()(
  persist(
    (set) => ({
      panelWidth: DEFAULT_PINNED_WIDTH,
      setPanelWidth: (n) =>
        set({
          panelWidth: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, n)),
        }),
      notes: "",
      notesHydrated: false,
      notesDraft: "",
      notesSaving: false,
      notesSavedAt: null,

      nodes: null,
      positions: {},
      mindMapHydrated: false,
      format: "notes",
      panelGroup: "organize",
      openGroup: (group) =>
        set({
          panelGroup: group,
          format: GROUP_TABS[group][0],
          open: true,
        }),
      open: false,
      pinned: false,
      currentBrainstormId: null,
      setCurrentBrainstormId: (id) => set({ currentBrainstormId: id }),

      bsOpen: false,
      bsPinned: false,
      bsWidth: 480,
      setBsOpen: (b) => set({ bsOpen: b }),
      toggleBsPin: () =>
        set((s) => ({ bsPinned: !s.bsPinned, bsOpen: s.bsPinned ? false : true })),
      setBsWidth: (n) =>
        set({ bsWidth: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, n)) }),

      navCollapsed: false,
      toggleNavCollapsed: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
      organizing: false,
      error: null,

      setNotes: (text) => set({ notes: text, notesDraft: text }),
      setNotesDraft: (text) => set({ notesDraft: text }),
      setNotesSaving: (b) => set({ notesSaving: b }),
      setNotesSavedAt: (s) => set({ notesSavedAt: s }),
      markNotesHydrated: () => set({ notesHydrated: true }),
      setNodes: (n) => set({ nodes: n }),
      setPositions: (p) => set({ positions: p }),
      setMindMapHydrated: (b) => set({ mindMapHydrated: b }),
      setFormat: (f) => set({ format: f }),
      setOpen: (b) => set({ open: b }),
      togglePin: () =>
        set((s) => ({ pinned: !s.pinned, open: s.pinned ? false : true })),
      setOrganizing: (b) => set({ organizing: b }),
      setError: (s) => set({ error: s }),
      reset: () =>
        set({
          notes: "",
          notesDraft: "",
          notesSavedAt: null,
          nodes: null,
          positions: {},
          mindMapHydrated: false,
          organizing: false,
          error: null,
        }),
    }),
    {
      name: "wc-organize",
      // Persist only UI prefs locally. Notes AND the mind map live in the DB —
      // we always hydrate from server on mount.
      partialize: (s) => ({
        format: s.format,
        panelGroup: s.panelGroup,
        pinned: s.pinned,
        open: s.open,
        panelWidth: s.panelWidth,
        currentBrainstormId: s.currentBrainstormId,
        bsOpen: s.bsOpen,
        bsPinned: s.bsPinned,
        bsWidth: s.bsWidth,
        navCollapsed: s.navCollapsed,
      }),
    },
  ),
);
