"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateTaggedSentence } from "@/server/scenes";
import { TAG_LABELS, TAG_COLORS, type TagKind } from "@/lib/tags";
import { TAG_MARK_NAMES } from "@/lib/tag-mark";

export function TagRow({
  kind,
  sentence,
  tagOffsetInSentence,
  tagLengthInSentence,
  sceneId,
  sceneTitle,
  chapterTitle,
  blockIndex,
  sentenceStart,
  sentenceEnd,
}: {
  kind: TagKind;
  sentence: string;
  tagOffsetInSentence: number;
  tagLengthInSentence: number;
  sceneId: string;
  sceneTitle: string;
  chapterTitle: string;
  blockIndex: number;
  sentenceStart: number;
  sentenceEnd: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(sentence);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const dirty = value !== sentence;
  const showTextarea = editing || dirty;
  const swatch = TAG_COLORS[kind].swatch;
  const markName = TAG_MARK_NAMES[kind];

  const tagEnd = tagOffsetInSentence + tagLengthInSentence;
  const before = sentence.slice(0, tagOffsetInSentence);
  const tagged = sentence.slice(tagOffsetInSentence, tagEnd);
  const after = sentence.slice(tagEnd);

  function autosize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (showTextarea) autosize(taRef.current);
  }, [value, showTextarea]);

  function enterEdit() {
    setEditing(true);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function commit(keep: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTaggedSentence({
          sceneId,
          blockIndex,
          sentenceStart,
          sentenceEnd,
          newText: value,
          keepTagMarkName: keep ? markName : null,
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "save failed");
      }
    });
  }

  function discard() {
    setValue(sentence);
    setError(null);
    setEditing(false);
  }

  return (
    <li
      className="bg-[var(--wc-surface)] border border-[var(--wc-border)] rounded-md p-3 hover:border-[var(--wc-border-strong)] focus-within:border-[var(--wc-border-strong)] focus-within:shadow-sm transition cursor-text"
      style={{ borderLeft: `4px solid ${swatch}` }}
      onClick={enterEdit}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-3 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="font-medium uppercase tracking-wider"
            style={{ color: swatch }}
          >
            {TAG_LABELS[kind]}
          </span>
          <Link
            href={`/app/scene/${sceneId}`}
            className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            {chapterTitle} · {sceneTitle}
          </Link>
        </div>
      </div>

      {showTextarea ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (!dirty) setEditing(false);
          }}
          disabled={pending}
          rows={1}
          className="w-full font-serif text-base text-[var(--wc-ink)] leading-relaxed bg-transparent border-0 outline-none resize-none p-0"
        />
      ) : (
        <p
          tabIndex={0}
          onFocus={enterEdit}
          className="font-serif text-base text-[var(--wc-ink)] leading-relaxed outline-none"
        >
          {before}
          <span className="wc-tag" data-kind={kind}>
            {tagged}
          </span>
          {after}
        </p>
      )}

      {dirty && (
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--wc-border)] mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              commit(true);
            }}
            disabled={pending}
            className="rounded-md bg-[var(--wc-slate)] px-3 py-1 text-xs text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)] disabled:opacity-50"
            title="Save edits, keep this passage tagged"
          >
            Save
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              commit(false);
            }}
            disabled={pending}
            className="rounded-md border border-[var(--wc-border-strong)] px-3 py-1 text-xs text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)] disabled:opacity-50"
            title="Save edits and remove the tag"
          >
            Save &amp; resolve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              discard();
            }}
            disabled={pending}
            className="rounded-md px-3 py-1 text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
          >
            Discard
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </li>
  );
}
