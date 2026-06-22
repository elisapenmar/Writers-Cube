"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  OUTLINE_TEMPLATES,
  newNodeId,
  numberFor,
  type OutlineNode,
  type OutlineTemplateKey,
} from "@/lib/outline-templates";
import {
  getOutline,
  chooseTemplate,
  saveOutline,
  fillOutlineFromNotes,
  fillOutlineFromBrainstorm,
  fillOutlineFromManuscript,
} from "@/server/outline";
import { AiSourceMenu } from "@/components/ai-source-menu";

type Loaded = { tree: OutlineNode; template: OutlineTemplateKey } | null;

export function OutlineTab() {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server
  useEffect(() => {
    void (async () => {
      try {
        const result = await getOutline();
        setLoaded(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load outline");
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  function scheduleSave(tree: OutlineNode) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveOutline(tree);
        setSavedAt(new Date().toISOString());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  function applyTreeChange(updater: (prev: OutlineNode) => OutlineNode) {
    setLoaded((prev) => {
      if (!prev) return prev;
      const nextTree = updater(prev.tree);
      scheduleSave(nextTree);
      return { ...prev, tree: nextTree };
    });
  }

  function onPickTemplate(key: OutlineTemplateKey) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await chooseTemplate(key);
        setLoaded(result);
        setSavedAt(new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pick template failed");
      }
    });
  }

  async function onFill(source: string) {
    if (!loaded) return;
    setError(null);
    setFilling(true);
    try {
      const fn =
        source === "brainstorm"
          ? fillOutlineFromBrainstorm
          : source === "manuscript"
          ? fillOutlineFromManuscript
          : fillOutlineFromNotes;
      const updated = await fn(loaded.tree);
      setLoaded({ ...loaded, tree: updated });
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fill failed");
    } finally {
      setFilling(false);
    }
  }

  function onChangeTemplate() {
    if (
      confirm(
        "Replace your current outline with a new template? Your existing structure will be lost (notes inside nodes too).",
      )
    ) {
      setLoaded(null);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading outline…
      </div>
    );
  }

  if (error && !loaded) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <TemplatePicker onPick={onPickTemplate} pending={pending} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <div className="text-[var(--wc-faint)]">
          <span className="text-[var(--wc-muted)] font-medium">
            {OUTLINE_TEMPLATES.find((t) => t.key === loaded.template)?.name ??
              "Custom"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AiSourceMenu
            label="Fill"
            busy={filling || pending}
            options={[
              { key: "notes", label: "From notes", hint: "Your working notes" },
              { key: "brainstorm", label: "From brainstorm", hint: "The thought-partner chat" },
              { key: "manuscript", label: "From manuscript", hint: "Your actual prose" },
            ]}
            onSelect={onFill}
          />
          <button
            onClick={onChangeTemplate}
            disabled={filling || pending}
            className="rounded-md px-2.5 py-1 text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-40"
          >
            Change template…
          </button>
          <SaveLabel saving={saving} savedAt={savedAt} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <OutlineNodeView
          node={loaded.tree}
          depth={-1} /* root displays without numbering */
          index={0}
          isRoot
          onChange={applyTreeChange}
        />
      </div>
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      )}
    </div>
  );
}

function TemplatePicker({
  onPick,
  pending,
}: {
  onPick: (key: OutlineTemplateKey) => void;
  pending: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <p className="text-sm text-[var(--wc-muted)] mb-4">
        Pick a starting structure or begin from scratch. You can rename, add, or
        delete sections at any time.
      </p>
      <ul className="space-y-2">
        {OUTLINE_TEMPLATES.map((t) => (
          <li key={t.key}>
            <button
              onClick={() => onPick(t.key)}
              disabled={pending}
              className="w-full text-left rounded-md border border-[var(--wc-border)] hover:border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-4 py-3 disabled:opacity-40"
            >
              <div className="font-serif text-base text-[var(--wc-ink)]">{t.name}</div>
              <div className="text-xs text-[var(--wc-faint)] mt-0.5">{t.description}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutlineNodeView({
  node,
  depth,
  index,
  isRoot,
  onChange,
}: {
  node: OutlineNode;
  depth: number;
  index: number;
  isRoot?: boolean;
  onChange: (updater: (prev: OutlineNode) => OutlineNode) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  function updateThisNode(patch: (n: OutlineNode) => OutlineNode) {
    onChange((root) => patchById(root, node.id, patch));
  }

  function addChild() {
    updateThisNode((n) => ({
      ...n,
      children: [...n.children, { id: newNodeId(), title: "New section", children: [] }],
    }));
  }

  function addSiblingAfter() {
    onChange((root) => insertSibling(root, node.id));
  }

  function deleteSelf() {
    if (!confirm(`Delete "${node.title}" and its children?`)) return;
    onChange((root) => removeById(root, node.id));
  }

  const numbering = isRoot ? "" : numberFor(depth, index);

  return (
    <div className={isRoot ? "" : "ml-4"}>
      <div className="group flex items-start gap-2 py-1">
        {!isRoot && (
          <span className="font-serif text-[var(--wc-faint)] text-sm pt-1 min-w-[2.2rem] text-right">
            {numbering}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={node.title}
              onBlur={(e) => {
                updateThisNode((n) => ({ ...n, title: e.target.value.trim() || n.title }));
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className={`w-full bg-[var(--wc-surface)] border border-[var(--wc-border-strong)] rounded px-1.5 py-0.5 outline-none ${
                isRoot ? "font-serif text-lg" : "font-serif text-base"
              }`}
            />
          ) : (
            <div
              onClick={() => setEditingTitle(true)}
              className={`cursor-text hover:bg-[var(--wc-canvas)] rounded px-1 py-0.5 ${
                isRoot
                  ? "font-serif text-lg text-[var(--wc-ink)]"
                  : "font-serif text-base text-[var(--wc-ink)]"
              }`}
              title="Click to edit"
            >
              {node.title}
            </div>
          )}

          {(editingNotes || node.notes) && (
            <NotesEditor
              key={node.id + "-notes"}
              value={node.notes ?? ""}
              editing={editingNotes}
              onStartEdit={() => setEditingNotes(true)}
              onChange={(text) => {
                updateThisNode((n) => ({ ...n, notes: text }));
              }}
              onStopEdit={() => setEditingNotes(false)}
            />
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 pt-0.5">
          {!editingNotes && !node.notes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
              title="Add notes"
            >
              + notes
            </button>
          )}
          <button
            onClick={addChild}
            className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
            title="Add a sub-section"
          >
            +sub
          </button>
          {!isRoot && (
            <>
              <button
                onClick={addSiblingAfter}
                className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
                title="Add a sibling below"
              >
                +
              </button>
              <button
                onClick={deleteSelf}
                className="text-xs text-[var(--wc-faint)] hover:text-red-700"
                title="Delete"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div>
          {node.children.map((c, i) => (
            <OutlineNodeView
              key={c.id}
              node={c}
              depth={depth + 1}
              index={i}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotesEditor({
  value,
  editing,
  onStartEdit,
  onStopEdit,
  onChange,
}: {
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const cleaned = normalizeBullets(draft);
          if (cleaned !== value) onChange(cleaned);
          setDraft(cleaned);
          onStopEdit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            onStopEdit();
          }
          // Enter starts a new bullet (Shift+Enter for a soft line).
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const ta = e.currentTarget;
            const pos = ta.selectionStart;
            const next = draft.slice(0, pos) + "\n• " + draft.slice(ta.selectionEnd);
            setDraft(next);
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = pos + 3;
            });
          }
        }}
        rows={Math.max(2, draft.split("\n").length + 1)}
        placeholder="• A beat or note per line…"
        className="w-full mt-1 bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1.5 text-sm font-serif leading-relaxed outline-none focus:border-[var(--wc-border-strong)]"
      />
    );
  }
  const bullets = bulletLines(value);
  return (
    <div
      onClick={() => {
        onStartEdit();
        if (!value.trim()) setDraft("• ");
      }}
      className="mt-0.5 ml-1 cursor-text text-sm text-[var(--wc-muted)] font-serif leading-relaxed hover:bg-[var(--wc-canvas)] rounded px-1"
    >
      {bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : (
        <span className="italic text-[var(--wc-faint)]">Add notes…</span>
      )}
    </div>
  );
}

/** Clean bullet strings (leading •/-/* removed). */
function bulletLines(text: string): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

/** Re-emit as one "• "-prefixed line per bullet. */
function normalizeBullets(text: string): string {
  return bulletLines(text)
    .map((l) => `• ${l}`)
    .join("\n");
}

function SaveLabel({
  saving,
  savedAt,
}: {
  saving: boolean;
  savedAt: string | null;
}) {
  if (saving) return <span className="text-[var(--wc-faint)]">Saving…</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return (
      <span className="text-[var(--wc-faint)]">
        Saved {hh}:{mm}
      </span>
    );
  }
  return null;
}

// --- pure tree helpers ---

function patchById(
  node: OutlineNode,
  id: string,
  patcher: (n: OutlineNode) => OutlineNode,
): OutlineNode {
  if (node.id === id) return patcher(node);
  return {
    ...node,
    children: node.children.map((c) => patchById(c, id, patcher)),
  };
}

function removeById(node: OutlineNode, id: string): OutlineNode {
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== id)
      .map((c) => removeById(c, id)),
  };
}

function insertSibling(root: OutlineNode, targetId: string): OutlineNode {
  return {
    ...root,
    children: insertSiblingInto(root.children, targetId),
  };
}
function insertSiblingInto(
  list: OutlineNode[],
  targetId: string,
): OutlineNode[] {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === targetId) {
      const next = [...list];
      next.splice(i + 1, 0, {
        id: newNodeId(),
        title: "New section",
        children: [],
      });
      return next;
    }
  }
  return list.map((n) => ({
    ...n,
    children: insertSiblingInto(n.children, targetId),
  }));
}
