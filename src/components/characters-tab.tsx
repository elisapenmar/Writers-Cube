"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  pullCharactersFromBrainstorm,
  pullCharactersFromProject,
  citeCharacter,
  type Character,
} from "@/server/characters";
import { AiSourceMenu } from "@/components/ai-source-menu";
import { CharacterGrid } from "@/components/character-grid";
import { useOrganize } from "@/store/organize-store";

/** Tell the editor's Smart Text registry to re-read after a name change. */
function notifyElementsChanged() {
  window.dispatchEvent(new Event("wc:story-elements-changed"));
}

/** Split a description into clean bullet strings (leading •/-/* removed). */
function bulletLines(text: string): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

/** Re-emit a description as one "• "-prefixed line per bullet. */
function normalizeBullets(text: string): string {
  return bulletLines(text)
    .map((l) => `• ${l}`)
    .join("\n");
}

export function CharactersTab() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showGrid, setShowGrid] = useState(false);
  const [gridKey, setGridKey] = useState(0);
  const focusCharacterId = useOrganize((s) => s.focusCharacterId);
  const setFocusCharacterId = useOrganize((s) => s.setFocusCharacterId);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!focusCharacterId || characters === null) return;
    const el = document.getElementById(`wc-char-${focusCharacterId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusCharacterId);
      setTimeout(() => setHighlightId(null), 2200);
    }
    setFocusCharacterId(null);
  }, [focusCharacterId, characters, setFocusCharacterId]);

  async function load() {
    try {
      setCharacters(await listCharacters());
      setError(null);
      setGridKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  function addCharacter() {
    startTransition(async () => {
      try {
        const created = await createCharacter();
        setCharacters((prev) => [...(prev ?? []), created]);
        notifyElementsChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  async function onPull(source: "brainstorm" | "project") {
    setPulling(true);
    setError(null);
    setInfo(null);
    try {
      const result =
        source === "brainstorm"
          ? await pullCharactersFromBrainstorm()
          : await pullCharactersFromProject();
      await load();
      notifyElementsChanged();
      const bits: string[] = [];
      if (result.added) bits.push(`${result.added} new`);
      if (result.filled) bits.push(`${result.filled} filled`);
      const where = source === "brainstorm" ? "brainstorm" : "manuscript";
      setInfo(
        bits.length
          ? `Pulled from ${where}: ${bits.join(", ")}. (Your manual edits were kept.)`
          : `Nothing new to pull. Your list already covers what's in the ${where}.`,
      );
      // From the manuscript: also link each bullet to the scene that supports it.
      if (source === "project") {
        const fresh = await listCharacters();
        for (const c of fresh) {
          if (c.description?.trim()) {
            try {
              const bullets = await citeCharacter(c.id);
              applyPatch(c.id, { bullets });
            } catch {
              /* skip a character whose citation pass fails */
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setPulling(false);
    }
  }

  function applyPatch(id: string, patch: Partial<Character>) {
    setCharacters((prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function removeLocal(id: string) {
    setCharacters((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  if (characters === null && !error) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading characters…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <div className="text-[var(--wc-faint)]">
          {(characters?.length ?? 0)} character
          {(characters?.length ?? 0) === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowGrid((g) => !g)}
            className={`rounded-md px-2 py-1 text-xs border ${
              showGrid
                ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)] border-[var(--wc-slate)]"
                : "border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
            }`}
            title="Show where each character appears, chapter by chapter"
          >
            ▦ Grid
          </button>
          <AiSourceMenu
            label={(characters?.length ?? 0) > 0 ? "Update" : "Generate"}
            busy={pulling || pending}
            options={[
              { key: "brainstorm", label: "From brainstorm", hint: "The thought-partner chat + notes" },
              { key: "project", label: "From manuscript", hint: "Your actual prose" },
            ]}
            onSelect={(k) => onPull(k as "brainstorm" | "project")}
          />
          <button
            onClick={addCharacter}
            disabled={pending || pulling}
            className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {info && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-xs text-amber-900">
            {info}
            <button onClick={() => setInfo(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}
        {showGrid && (
          <div className="mb-1">
            <CharacterGrid refreshKey={gridKey} />
            <p className="mt-1 text-[10px] text-[var(--wc-faint)]">
              Numbers = name mentions per chapter. Click a cell to jump to the scene.
            </p>
          </div>
        )}
        {(characters ?? []).length === 0 && !error ? (
          <p className="text-sm text-[var(--wc-faint)]">
            No characters yet. Add one manually or, if you&apos;ve done some
            brainstorming, click <b>Pull from brainstorm</b> to draft them from
            the conversation.
          </p>
        ) : (
          (characters ?? []).map((c) => (
            <div
              key={c.id}
              id={`wc-char-${c.id}`}
              className={
                highlightId === c.id
                  ? "rounded-md ring-2 ring-[var(--wc-slate)] ring-offset-1 transition"
                  : "transition"
              }
            >
              <CharacterCard
                character={c}
                onPatch={(patch) => applyPatch(c.id, patch)}
                onDelete={() => removeLocal(c.id)}
                onError={setError}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  onPatch,
  onDelete,
  onError,
}: {
  character: Character;
  onPatch: (patch: Partial<Character>) => void;
  onDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role ?? "");
  const [description, setDescription] = useState(character.description);
  const [savingDescription, setSavingDescription] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [citing, setCiting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function cite() {
    setCiting(true);
    try {
      const bullets = await citeCharacter(character.id);
      onPatch({ bullets });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Citation failed");
    } finally {
      setCiting(false);
    }
  }

  useEffect(() => {
    setName(character.name);
    setRole(character.role ?? "");
    setDescription(character.description);
  }, [character.id, character.name, character.role, character.description]);

  function schedule(patch: Partial<Character>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingDescription(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const update: { name?: string; role?: string | null; description?: string } = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.role !== undefined) update.role = patch.role;
        if (patch.description !== undefined) update.description = patch.description;
        await updateCharacter(character.id, update);
        onPatch(patch);
        if (patch.name !== undefined) notifyElementsChanged();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSavingDescription(false);
      }
    }, 500);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${character.name}"?`)) return;
    try {
      await deleteCharacter(character.id);
      onDelete();
      notifyElementsChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 w-4 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          title={expanded ? "Collapse" : "Expand details"}
          aria-label="Toggle character details"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== character.name) schedule({ name });
          }}
          placeholder="Name"
          className="flex-1 bg-transparent border-0 outline-none font-serif text-base text-[var(--wc-ink)] px-0"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => {
            if (role !== (character.role ?? "")) schedule({ role: role || null });
          }}
          placeholder="role"
          className="w-32 bg-transparent border-0 outline-none text-xs text-[var(--wc-faint)] px-0 text-right"
        />
        <button
          onClick={handleDelete}
          className="text-xs text-[var(--wc-faint)] hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>

      {!expanded ? (
        <div
          onClick={() => setExpanded(true)}
          className="mt-1 cursor-pointer text-sm text-[var(--wc-muted)] font-serif leading-snug hover:bg-[var(--wc-canvas)] rounded px-1 -mx-1"
        >
          {bulletLines(description).length > 0 ? (
            <p className="line-clamp-2">
              {bulletLines(description)[0]}
              {bulletLines(description).length > 1 && (
                <span className="text-[10px] text-[var(--wc-faint)]">
                  {" "}
                  · +{bulletLines(description).length - 1} more
                </span>
              )}
            </p>
          ) : (
            <span className="italic text-[var(--wc-faint)]">
              Broad strokes, click to add details
            </span>
          )}
        </div>
      ) : editingDescription ? (
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            const cleaned = normalizeBullets(description);
            if (cleaned !== character.description) schedule({ description: cleaned });
            setDescription(cleaned);
            setEditingDescription(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDescription(character.description);
              setEditingDescription(false);
            }
            // Enter starts a new bullet (Shift+Enter for a soft line).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const ta = e.currentTarget;
              const pos = ta.selectionStart;
              const next = description.slice(0, pos) + "\n• " + description.slice(ta.selectionEnd);
              setDescription(next);
              requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = pos + 3;
              });
            }
          }}
          rows={Math.max(3, description.split("\n").length + 1)}
          className="w-full mt-2 bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1.5 text-sm font-serif leading-relaxed outline-none focus:border-[var(--wc-border-strong)]"
          placeholder="• A trait, fact, or arc beat per line…"
        />
      ) : (
        <>
          <div
            onClick={() => {
              setEditingDescription(true);
              if (!description.trim()) setDescription("• ");
            }}
            className="mt-1 cursor-text text-sm text-[var(--wc-muted)] font-serif leading-relaxed min-h-[1.2em] hover:bg-[var(--wc-canvas)] rounded px-1 -mx-1"
          >
            {bulletLines(description).length > 0 ? (
              <ul className="list-disc pl-5 space-y-0.5">
                {bulletLines(description).map((line, i) => {
                  const c = (character.bullets ?? []).find((b) => b.text === line);
                  return (
                    <li key={i}>
                      {line}
                      {c?.sceneId && (
                        <Link
                          href={`/app/scene/${c.sceneId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1.5 align-baseline text-[10px] text-[var(--wc-slate)] hover:underline"
                          title="Where this shows in the manuscript"
                        >
                          {c.label ?? "source"} ↗
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="italic text-[var(--wc-faint)]">
                Traits, arc, voice, one bullet per line…
              </span>
            )}
          </div>
          {bulletLines(description).length > 0 && (
            <button
              onClick={cite}
              disabled={citing}
              className="mt-1.5 text-[10px] text-[var(--wc-slate)] hover:underline disabled:opacity-50"
              title="Find the scene that supports each bullet and link it"
            >
              {citing ? "Citing…" : "⌖ Cite from manuscript"}
            </button>
          )}
        </>
      )}

      {savingDescription && (
        <div className="text-[10px] text-[var(--wc-faint)] mt-1">Saving…</div>
      )}
    </div>
  );
}
