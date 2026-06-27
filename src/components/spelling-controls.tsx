"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  onSpellChange,
  spellEnabled,
  setSpellEnabled,
  ensureSpeller,
  personalWords,
  removeWord,
} from "@/lib/spellcheck";

/** Spelling on/off + a "manage dictionary" modal, shown inside Page setup. */
export function SpellingControls() {
  const enabled = useSyncExternalStore(
    onSpellChange,
    () => spellEnabled(),
    () => true,
  );
  const [mgrOpen, setMgrOpen] = useState(false);

  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-[var(--wc-muted)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setSpellEnabled(e.target.checked)}
        />
        Check spelling
      </label>
      <button
        onClick={() => setMgrOpen(true)}
        className="mt-1.5 text-xs text-[var(--wc-slate)] hover:underline"
      >
        Manage dictionary…
      </button>
      {mgrOpen && <DictionaryManager onClose={() => setMgrOpen(false)} />}
    </div>
  );
}

function DictionaryManager({ onClose }: { onClose: () => void }) {
  const [words, setWords] = useState<string[] | null>(null);

  // Make sure the account dictionary is loaded before listing it.
  useEffect(() => {
    let alive = true;
    void ensureSpeller().finally(() => {
      if (alive) setWords(personalWords());
    });
    return () => {
      alive = false;
    };
  }, []);

  async function remove(word: string) {
    setWords((w) => (w ?? []).filter((x) => x !== word));
    await removeWord(word);
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-sm rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 shadow-[var(--wc-shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-serif text-base text-[var(--wc-ink)]">Your dictionary</h3>
          <button
            onClick={onClose}
            className="rounded px-2 text-sm text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          >
            ✕
          </button>
        </div>
        {words === null ? (
          <p className="py-6 text-center text-sm text-[var(--wc-faint)]">Loading…</p>
        ) : words.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--wc-faint)]">
            No saved words yet. Right-click a flagged word and choose “Add to dictionary.”
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--wc-border)]">
            {words.map((w) => (
              <li key={w} className="flex items-center justify-between py-1.5">
                <span className="truncate text-sm text-[var(--wc-ink)]">{w}</span>
                <button
                  onClick={() => remove(w)}
                  className="ml-2 shrink-0 rounded px-2 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-rust,#c0392b)]"
                  title="Remove from dictionary"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
