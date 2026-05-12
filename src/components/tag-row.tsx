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

  useEffect(() => {
    if (showTextarea) autosize(taRef.current);
  }, [value, showTextarea]);

  function autosize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

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
      className="bg-white border border-zinc-200 rounded-md p-3 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:shadow-sm transition cursor-text"
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
            className="text-zinc-500 hover:text-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {chapterTitle} › {sceneTitle}
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
          className="w-full font-serif text-base text-zinc-800 leading-relaxed bg-transparent border-0 outline-none resize-none p-0"
        />
      ) : (
        <p
          tabIndex={0}
          onFocus={enterEdit}
          className="font-serif text-base text-zinc-800 leading-relaxed outline-none"
        >
          {before}
          <span className="wc-tag" data-kind={kind}>
            {tagged}
          </span>
          {after}
        </p>
      )}

      {dirty && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              commit(true);
            }}
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
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
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
            className="rounded-md px-3 py-1 text-xs text-zinc-500 hover:text-zinc-900"
          >
            Discard
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </li>
  );
}
