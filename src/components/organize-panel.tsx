"use client";

import { useEffect, useRef, useState } from "react";
import { extractDocumentText } from "@/server/import";

const LEGACY_STORAGE_KEY = "wc-organize";

function readLegacyMindMapFromLocalStorage(): MindMapNode[] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { nodes?: MindMapNode[] | null };
    };
    const nodes = parsed.state?.nodes;
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) return null;
    return nodes
      .filter((n) => n && n.id && n.label)
      .map((n) => ({
        id: String(n.id),
        label: String(n.label),
        parent: n.parent ? String(n.parent) : null,
      }));
  } catch {
    return null;
  }
}

function clearLegacyMindMapInLocalStorage() {
  try {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      delete parsed.state.nodes;
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // best effort
  }
}

import {
  useOrganize,
  GROUP_TABS,
  GROUP_LABEL,
  type OrganizeFormat,
} from "@/store/organize-store";

const TAB_LABEL: Record<OrganizeFormat, string> = {
  notes: "Notes",
  mindmap: "Map",
  outline: "Outline",
  characters: "Characters",
  canvas: "Canvas",
  timeline: "Timeline",
};
import { MindMap } from "@/components/mind-map";
import { OutlineTab } from "@/components/outline-tree";
import { CharactersTab } from "@/components/characters-tab";
import { CanvasTab } from "@/components/canvas-tab";
import { TimelineTab } from "@/components/timeline-tab";
import {
  organizeBrainstorm,
  getNotes,
  saveNotes,
} from "@/server/brainstorm";
import { getMindMap, saveMindMap } from "@/server/mindmap";
import type { MindMapNode } from "@/server/brainstorm";

export function OrganizePanel() {
  const {
    notes,
    notesHydrated,
    notesDraft,
    notesSaving,
    notesSavedAt,
    nodes,
    positions,
    mindMapHydrated,
    format,
    panelGroup,
    open,
    pinned,
    panelWidth,
    organizing,
    error,
    setNotes,
    setNotesDraft,
    setNotesSaving,
    setNotesSavedAt,
    markNotesHydrated,
    setNodes,
    setPositions,
    setMindMapHydrated,
    setFormat,
    setOpen,
    togglePin,
    setPanelWidth,
    setOrganizing,
    setError,
  } = useOrganize();

  const visible = open || pinned;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate notes from the server on first mount
  useEffect(() => {
    if (!notesHydrated) {
      void (async () => {
        try {
          const text = await getNotes();
          setNotes(text);
        } catch {
          // Ignore hydration errors; notes stay empty
        } finally {
          markNotesHydrated();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesHydrated]);

  // Hydrate mind map from DB, with a one-shot rescue for any pre-DB map
  // that's still sitting in this browser's localStorage from before this update.
  useEffect(() => {
    if (!mindMapHydrated) {
      void (async () => {
        try {
          const saved = await getMindMap();
          if (saved.nodes.length > 0) {
            setNodes(saved.nodes);
            setPositions(saved.positions);
          } else {
            // DB is empty — check legacy localStorage for a previous mind map
            const legacy = readLegacyMindMapFromLocalStorage();
            if (legacy && legacy.length > 0) {
              setNodes(legacy);
              setPositions({});
              try {
                await saveMindMap({ nodes: legacy, positions: {} });
                clearLegacyMindMapInLocalStorage();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? `Mind map rescued from local storage but couldn't be saved: ${e.message}`
                    : "Mind map rescue save failed",
                );
              }
            } else {
              setPositions({});
            }
          }
        } catch (e) {
          setError(
            e instanceof Error
              ? `Mind map didn't load: ${e.message}`
              : "Mind map didn't load",
          );
        } finally {
          setMindMapHydrated(true);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindMapHydrated]);

  // Debounced autosave of notesDraft
  function scheduleSave(text: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNotesSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveNotes(text);
        setNotes(text);
        setNotesSavedAt(new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setNotesSaving(false);
      }
    }, 700);
  }

  if (!visible) return null;
  const widthStyle = { width: `${panelWidth}px`, maxWidth: "95vw" };

  async function generate() {
    if (
      format === "outline" ||
      format === "characters" ||
      format === "canvas" ||
      format === "timeline"
    )
      return;
    setOrganizing(true);
    setError(null);
    try {
      const result = await organizeBrainstorm(format);
      if (result.format === "notes") {
        setNotes(result.text);
        setNotesSavedAt(new Date().toISOString());
      } else {
        setNodes(result.nodes);
        setPositions({}); // regen wipes manual positions
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Organize failed");
    } finally {
      setOrganizing(false);
    }
  }

  const hasCurrent =
    format === "notes"
      ? notes.trim().length > 0
      : format === "mindmap"
      ? nodes !== null
      : false;

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const handlePointerMove = (ev: PointerEvent) => {
      const dx = startX - ev.clientX;
      setPanelWidth(startWidth + dx);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }
  const width = pinned ? "w-[30rem]" : "w-full md:w-[min(70vw,1000px)]";

  return (
    <aside
      className="fixed inset-y-0 right-0 z-30 bg-[var(--wc-surface)] border-l border-[var(--wc-border)] flex flex-col shadow-2xl"
      style={widthStyle}
    >
      <div
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[var(--wc-stone)] active:bg-[var(--wc-stone)] z-40"
        title="Drag to resize"
      />
      <header className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-3 gap-2">
        <h2 className="font-serif text-base shrink-0">{GROUP_LABEL[panelGroup]}</h2>
        <div className="flex items-center gap-1 flex-1 justify-end">
          <div className="flex flex-wrap">
            {GROUP_TABS[panelGroup].map((tab, i) => (
              <button
                key={tab}
                onClick={() => setFormat(tab)}
                className={`py-1 px-2 text-xs border ${i === 0 ? "rounded-l-md" : "-ml-px"} ${
                  i === GROUP_TABS[panelGroup].length - 1 ? "rounded-r-md" : ""
                } ${
                  format === tab
                    ? "bg-[var(--wc-slate)] text-white border-[var(--wc-slate)]"
                    : "bg-[var(--wc-surface)] border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                }`}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>
          {format !== "outline" &&
            format !== "characters" &&
            format !== "canvas" &&
            format !== "timeline" && (
            <button
              onClick={generate}
              disabled={organizing}
              className="rounded-md bg-[var(--wc-slate)] px-2.5 py-1 text-xs text-white hover:bg-[var(--wc-slate)] disabled:opacity-40"
              title={
                format === "notes"
                  ? hasCurrent
                    ? "Have the AI add new ideas from the conversation to your notes"
                    : "Have the AI distill the conversation into notes"
                  : hasCurrent
                  ? "Redraw the thought map from the conversation"
                  : "Generate a thought map from the conversation"
              }
            >
              {organizing
                ? "…"
                : format === "notes" && hasCurrent
                ? "Add from chat"
                : "Generate"}
            </button>
          )}
          <button
            onClick={togglePin}
            className={`rounded-md px-2 py-1 text-xs border ${
              pinned
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
            }`}
            title={
              pinned
                ? "Unpin from side"
                : "Pin to right side (keeps visible across pages)"
            }
          >
            {pinned ? "Pinned" : "Pin"}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              if (pinned) useOrganize.setState({ pinned: false });
            }}
            className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] text-lg leading-none px-1"
            title="Close"
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-xs text-red-800">
            <div className="font-medium mb-0.5">Something went wrong</div>
            <div className="whitespace-pre-wrap break-words">{error}</div>
            <button
              onClick={() => setError(null)}
              className="mt-1 text-red-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {format === "timeline" ? (
          <TimelineTab />
        ) : format === "canvas" ? (
          <CanvasTab />
        ) : format === "characters" ? (
          <CharactersTab />
        ) : format === "outline" ? (
          <OutlineTab />
        ) : format === "notes" ? (
          <NotesEditor
            value={notesDraft || notes}
            saving={notesSaving}
            savedAt={notesSavedAt}
            onChange={(next) => {
              setNotesDraft(next);
              scheduleSave(next);
            }}
          />
        ) : nodes && nodes.length > 0 ? (
          <>
            <MindMap rawNodes={nodes} initialPositions={positions} />
            <p className="px-4 py-2 text-xs text-[var(--wc-faint)] border-t border-[var(--wc-border)]">
              Double-click to edit a bubble. Hover for + (add child) and × (delete). Drag to rearrange — positions and edits save automatically.
            </p>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6 text-center">
            {organizing
              ? "Generating…"
              : "Click Generate to draw a thought map you can rearrange and edit."}
          </div>
        )}
      </div>
    </aside>
  );
}

function NotesEditor({
  value,
  saving,
  savedAt,
  onChange,
}: {
  value: string;
  saving: boolean;
  savedAt: string | null;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 py-1 text-xs text-[var(--wc-faint)] border-b border-[var(--wc-border)]">
        <ImportDocButton
          onImported={(text) => onChange(value ? `${value}\n\n${text}` : text)}
        />
        <SaveLabel saving={saving} savedAt={savedAt} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={true}
        placeholder="Your working notes will appear here. Edit freely — your changes save automatically.

Run a brainstorm session, then click 'Generate' (or 'Add from chat' once notes exist) to have the AI distill the conversation into notes here."
        className="flex-1 resize-none p-5 bg-[var(--wc-surface)] text-sm text-[var(--wc-ink)] leading-relaxed font-serif focus:outline-none whitespace-pre-wrap"
      />
    </div>
  );
}

function ImportDocButton({ onImported }: { onImported: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const text = await extractDocumentText(fd);
      if (text) onImported(text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-md px-1.5 py-0.5 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] hover:bg-[var(--wc-paper)] disabled:opacity-50"
        title="Import a .docx, .md, or .txt into your notes"
      >
        {busy ? "Importing…" : "↑ Import doc"}
      </button>
      {err && <span className="text-red-500">{err}</span>}
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.md,.markdown,.txt"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}

function SaveLabel({
  saving,
  savedAt,
}: {
  saving: boolean;
  savedAt: string | null;
}) {
  if (saving) return <span>Saving…</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return (
      <span>
        Saved at {hh}:{mm}
      </span>
    );
  }
  return <span>&nbsp;</span>;
}
