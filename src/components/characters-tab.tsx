"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  pullCharactersFromBrainstorm,
  pullCharactersFromProject,
  type Character,
} from "@/server/characters";
import { AiDiamond } from "@/components/icons";

export function CharactersTab() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setCharacters(await listCharacters());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  function addCharacter() {
    startTransition(async () => {
      try {
        const created = await createCharacter();
        setCharacters((prev) => [...(prev ?? []), created]);
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
      const bits: string[] = [];
      if (result.added) bits.push(`${result.added} new`);
      if (result.filled) bits.push(`${result.filled} filled`);
      const where = source === "brainstorm" ? "brainstorm" : "manuscript";
      setInfo(
        bits.length
          ? `Pulled from ${where}: ${bits.join(", ")}. (Your manual edits were kept.)`
          : `Nothing new to pull — your list already covers what's in the ${where}.`,
      );
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
            onClick={() => onPull("brainstorm")}
            disabled={pulling || pending}
            className="flex items-center gap-1 rounded-md border border-[var(--wc-border-strong)] px-2 py-1 hover:bg-[var(--wc-canvas)] disabled:opacity-40"
            title="Extract characters from your brainstorm conversation + notes. New names added; manual edits kept."
          >
            <AiDiamond className="text-[var(--wc-slate)]" />
            {pulling ? "…" : "Pull · brainstorm"}
          </button>
          <button
            onClick={() => onPull("project")}
            disabled={pulling || pending}
            className="flex items-center gap-1 rounded-md border border-[var(--wc-border-strong)] px-2 py-1 hover:bg-[var(--wc-canvas)] disabled:opacity-40"
            title="Extract characters from your actual manuscript prose. New names added; manual edits kept."
          >
            <AiDiamond className="text-[var(--wc-slate)]" />
            {pulling ? "…" : "Pull · manuscript"}
          </button>
          <button
            onClick={addCharacter}
            disabled={pending || pulling}
            className="rounded-md bg-[var(--wc-slate)] px-2 py-1 text-xs text-white hover:bg-[var(--wc-slate)] disabled:opacity-40"
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
        {(characters ?? []).length === 0 && !error ? (
          <p className="text-sm text-[var(--wc-faint)]">
            No characters yet. Add one manually or, if you&apos;ve done some
            brainstorming, click <b>Pull from brainstorm</b> to draft them from
            the conversation.
          </p>
        ) : (
          (characters ?? []).map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              onPatch={(patch) => applyPatch(c.id, patch)}
              onDelete={() => removeLocal(c.id)}
              onError={setError}
            />
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 group">
      <div className="flex items-center gap-2">
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

      {editingDescription ? (
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== character.description) {
              schedule({ description });
            }
            setEditingDescription(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDescription(character.description);
              setEditingDescription(false);
            }
          }}
          rows={Math.max(2, Math.ceil(description.length / 50))}
          className="w-full mt-2 bg-[var(--wc-canvas)] border border-[var(--wc-border)] rounded px-2 py-1.5 text-sm font-serif leading-relaxed outline-none focus:border-[var(--wc-border-strong)]"
          placeholder="Description, traits, arc, voice…"
        />
      ) : (
        <div
          onClick={() => setEditingDescription(true)}
          className="mt-1 cursor-text text-sm text-[var(--wc-muted)] font-serif leading-relaxed whitespace-pre-wrap min-h-[1.2em] hover:bg-[var(--wc-canvas)] rounded px-1 -mx-1"
        >
          {description || (
            <span className="italic text-[var(--wc-faint)]">Description, traits, arc, voice…</span>
          )}
        </div>
      )}

      {savingDescription && (
        <div className="text-[10px] text-[var(--wc-faint)] mt-1">Saving…</div>
      )}
    </div>
  );
}
