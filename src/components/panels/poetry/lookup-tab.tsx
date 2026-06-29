"use client";

import { useEffect, useRef, useState } from "react";
import {
  lookupDefine,
  lookupThesaurus,
  lookupRhymes,
  lookupSyllables,
} from "@/server/lookup";
import type { Definition, RhymeMatch } from "@/lib/lookup/types";
import { useActiveEditor } from "@/store/active-editor-store";

type Results = {
  word: string;
  syllables: number;
  definitions: Definition[];
  synonyms: string[];
  antonyms: string[];
  rhymes: RhymeMatch[];
};

const MAX_RHYMES = 40;

export function LookupTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedWord = useActiveEditor((s) => s.selectedWord);
  const lastAutoFill = useRef<string>("");

  // Auto-fill from the editor selection: when a word is selected, drop it into
  // the search box (only when the box is empty or still showing the last
  // auto-filled word, so it never stomps something the writer typed).
  useEffect(() => {
    const word = selectedWord.trim();
    if (!word) return;
    setQuery((prev) => {
      if (prev === "" || prev === lastAutoFill.current) {
        lastAutoFill.current = word;
        return word;
      }
      return prev;
    });
  }, [selectedWord]);

  async function run(raw: string) {
    const word = raw.trim().toLowerCase();
    if (!word) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [definitions, thesaurus, rhymes, syllables] = await Promise.all([
        lookupDefine(word),
        lookupThesaurus(word),
        lookupRhymes(word),
        lookupSyllables(word),
      ]);
      setResults({
        word,
        syllables,
        definitions,
        synonyms: thesaurus.synonyms,
        antonyms: thesaurus.antonyms,
        rhymes,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const perfect = results?.rhymes.filter((r) => r.kind === "perfect") ?? [];
  const slant = results?.rhymes.filter((r) => r.kind === "slant") ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="flex items-center gap-2 border-b border-[var(--wc-border)] px-3 py-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Look up a word…"
          className="flex-1 rounded-md border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-2.5 py-1.5 text-sm text-[var(--wc-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--wc-slate)]"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-[var(--wc-slate)] px-3 py-1.5 text-sm text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-40"
        >
          {loading ? "…" : "Look up"}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}

        {!results && !error && (
          <p className="px-1 py-6 text-center text-[var(--wc-faint)]">
            Search a word, or select one in your poem, to see its meaning,
            synonyms, rhymes, and syllable count.
          </p>
        )}

        {results && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg text-[var(--wc-ink)]">{results.word}</h3>
              <span className="text-xs text-[var(--wc-faint)] tabular-nums">
                {results.syllables} {results.syllables === 1 ? "syllable" : "syllables"}
              </span>
            </div>

            <Section title="Meaning">
              {results.definitions.length > 0 ? (
                <ul className="space-y-1.5">
                  {results.definitions.map((d, i) => (
                    <li key={i} className="leading-snug">
                      {d.partOfSpeech && (
                        <span className="mr-1.5 text-[11px] italic text-[var(--wc-faint)]">
                          {d.partOfSpeech}
                        </span>
                      )}
                      <span className="text-[var(--wc-ink)]">{d.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No definition on hand.</Empty>
              )}
            </Section>

            <Section title="Synonyms">
              {results.synonyms.length > 0 ? (
                <WordChips words={results.synonyms} onPick={(w) => { setQuery(w); void run(w); }} />
              ) : (
                <Empty>None found.</Empty>
              )}
            </Section>

            <Section title="Antonyms">
              {results.antonyms.length > 0 ? (
                <WordChips words={results.antonyms} onPick={(w) => { setQuery(w); void run(w); }} />
              ) : (
                <Empty>None found.</Empty>
              )}
            </Section>

            <Section title="Rhymes">
              {perfect.length === 0 && slant.length === 0 ? (
                <Empty>No rhymes found.</Empty>
              ) : (
                <div className="space-y-2">
                  {perfect.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
                        Perfect
                      </div>
                      <WordChips
                        words={perfect.slice(0, MAX_RHYMES).map((r) => r.word)}
                        onPick={(w) => { setQuery(w); void run(w); }}
                      />
                    </div>
                  )}
                  {slant.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--wc-faint)]">
                        Slant
                      </div>
                      <WordChips
                        words={slant.slice(0, MAX_RHYMES).map((r) => r.word)}
                        onPick={(w) => { setQuery(w); void run(w); }}
                      />
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--wc-muted)]">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--wc-faint)]">{children}</p>;
}

function WordChips({
  words,
  onPick,
}: {
  words: string[];
  onPick: (word: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onPick(w)}
          className="rounded-full border border-[var(--wc-border-strong)] bg-[var(--wc-surface)] px-2.5 py-0.5 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
          title={`Look up “${w}”`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
