"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Indent } from "@/lib/indent";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { EditorToolbar } from "@/components/editor-toolbar";
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
  tags: "Tags",
  prompts: "Prompts",
};
import { MindMap } from "@/components/mind-map";
import { OutlineTab } from "@/components/outline-tree";
import { CharactersTab } from "@/components/characters-tab";
import { TagsTab } from "@/components/tags-tab";
import { PromptsTab } from "@/components/prompts-tab";
import { AiSourceMenu } from "@/components/ai-source-menu";
import { CanvasTab } from "@/components/canvas-tab";
import { TimelineTab } from "@/components/timeline-tab";
import {
  organizeBrainstorm,
  getNotes,
  saveNotes,
} from "@/server/brainstorm";
import { getMindMap, saveMindMap } from "@/server/mindmap";
import { generateMindMapFromManuscript } from "@/server/ai-generate";
import { AiDiamond } from "@/components/icons";
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
            // DB is empty, check legacy localStorage for a previous mind map
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
      format === "timeline" ||
      format === "tags" ||
      format === "prompts"
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

  async function generateMapFrom(source: "brainstorm" | "manuscript") {
    setOrganizing(true);
    setError(null);
    try {
      const result =
        source === "manuscript"
          ? await generateMindMapFromManuscript()
          : await organizeBrainstorm("mindmap");
      if ("nodes" in result) {
        setNodes(result.nodes);
        setPositions({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
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
        <h2 className="font-serif text-base shrink-0 text-[var(--wc-ink)]">{GROUP_LABEL[panelGroup]}</h2>
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
                    ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)] border-[var(--wc-slate)]"
                    : "bg-[var(--wc-surface)] border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                }`}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>
          {format === "notes" && (
            <button
              onClick={generate}
              disabled={organizing}
              className="flex items-center gap-1 rounded-md bg-[var(--wc-slate)] px-2.5 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
              title={
                hasCurrent
                  ? "Have the AI add new ideas from the conversation to your notes"
                  : "Have the AI distill the conversation into notes"
              }
            >
              <AiDiamond className="text-[var(--wc-on-accent)]" />
              {organizing ? "…" : hasCurrent ? "Update" : "Generate"}
            </button>
          )}
          {format === "mindmap" && (
            <AiSourceMenu
              label={hasCurrent ? "Update" : "Generate"}
              busy={organizing}
              options={[
                { key: "manuscript", label: "From manuscript", hint: "Your actual prose + notes" },
                { key: "brainstorm", label: "From brainstorm", hint: "The thought-partner chat" },
              ]}
              onSelect={(k) => generateMapFrom(k as "manuscript" | "brainstorm")}
            />
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
        ) : format === "tags" ? (
          <TagsTab />
        ) : format === "prompts" ? (
          <PromptsTab />
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
              Double-click to edit a bubble. Hover for + (add child) and × (delete). Drag to rearrange, positions and edits save automatically.
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Notes are persisted as a string that now holds HTML. Legacy notes, AI-generated
// notes, and imported documents arrive as plain text, wrap them into paragraphs
// so they render (and keep their line breaks) in the rich editor.
function notesToHtml(value: string): string {
  if (!value) return "";
  if (/^\s*</.test(value)) return value; // already HTML
  return value
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
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
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Indent, TextStyle, FontFamily, ...ALL_TAG_MARKS],
    content: notesToHtml(value),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-full leading-relaxed focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  // Push external updates (AI "Generate"/"Add from chat", which set notes through
  // the store) into the editor, without echoing the editor's own output back.
  const lastSynced = useRef<string>(value);
  useEffect(() => {
    if (!editor) return;
    if (value === lastSynced.current || value === editor.getHTML()) {
      lastSynced.current = value;
      return;
    }
    editor.commands.setContent(notesToHtml(value), { emitUpdate: false });
    lastSynced.current = value;
  }, [value, editor]);

  const isEmpty = value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() === "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-[var(--wc-faint)] border-b border-[var(--wc-border)]">
        <ImportDocButton
          onImported={(text) =>
            editor?.chain().focus("end").insertContent(notesToHtml(text)).run()
          }
        />
        <SaveLabel saving={saving} savedAt={savedAt} />
      </div>
      <EditorToolbar
        editor={editor}
        className="border-b border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1"
      />
      <div className="relative flex-1 overflow-y-auto bg-[var(--wc-surface)] px-4 py-3">
        {isEmpty && (
          <p className="pointer-events-none absolute inset-x-4 top-3 text-sm text-[var(--wc-faint)] leading-relaxed">
            Your working notes appear here, edit freely; changes save
            automatically. Run a brainstorm, then click{" "}
            <span className="font-medium">Generate</span> to distill it into notes.
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
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
