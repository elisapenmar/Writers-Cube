"use client";

import { useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { TAG_MARK_NAMES } from "@/lib/tag-mark";
import { TAG_KINDS, TAG_LABELS, TAG_COLORS, type TagKind } from "@/lib/tags";
import { useCustomTags } from "@/store/custom-tags-store";

export function TagBubbleMenu({ editor }: { editor: Editor }) {
  const customTags = useCustomTags((s) => s.tags);
  const addCustom = useCustomTags((s) => s.add);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function applyCustom(label: string, color: string) {
    editor.chain().focus().setCustomTag({ label, color }).run();
  }

  function commitNew() {
    const def = addCustom(draft);
    setDraft("");
    setAdding(false);
    if (def) applyCustom(def.label, def.color);
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor, from, to }) => from !== to && editor.isEditable}
      className="flex items-center gap-1 rounded-md bg-[var(--wc-slate)] text-[var(--wc-on-accent)] px-1.5 py-1 shadow-lg text-xs"
    >
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNew();
              } else if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
            placeholder="New tag…"
            className="bg-[var(--wc-slate)] rounded px-1.5 py-0.5 text-[var(--wc-on-accent)] outline-none w-24 placeholder:text-[var(--wc-on-accent)]/60"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitNew}
            className="px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/30"
          >
            Add
          </button>
        </div>
      ) : (
        <>
          {TAG_KINDS.map((kind: TagKind) => {
            const markName = TAG_MARK_NAMES[kind];
            const active = editor.isActive(markName);
            return (
              <button
                key={kind}
                onClick={() => editor.chain().focus().toggleMark(markName).run()}
                className={`px-2 py-1 rounded hover:bg-black/20 ${active ? "bg-black/25" : ""}`}
                style={{ borderBottom: `2px solid ${TAG_COLORS[kind].underline}` }}
                title={TAG_LABELS[kind]}
              >
                {TAG_LABELS[kind]}
              </button>
            );
          })}

          {customTags.map((t) => {
            const active = editor.isActive("customTag", { label: t.label });
            return (
              <button
                key={t.id}
                onClick={() => applyCustom(t.label, t.color)}
                className={`px-2 py-1 rounded hover:bg-black/20 ${active ? "bg-black/25" : ""}`}
                style={{ borderBottom: `2px solid ${t.color}` }}
                title={`Custom tag: ${t.label}`}
              >
                {t.label}
              </button>
            );
          })}

          {editor.isActive("customTag") && (
            <button
              onClick={() => editor.chain().focus().unsetCustomTag().run()}
              className="px-1.5 py-1 rounded hover:bg-black/20 text-[var(--wc-on-accent)]"
              title="Remove custom tag"
            >
              ✕
            </button>
          )}

          <button
            onClick={() => setAdding(true)}
            className="ml-0.5 w-6 h-6 grid place-items-center rounded hover:bg-black/20 text-[var(--wc-on-accent)]"
            title="Add a custom tag"
          >
            +
          </button>
        </>
      )}
    </BubbleMenu>
  );
}
