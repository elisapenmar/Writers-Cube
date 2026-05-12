"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";

type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string }[];
};

export function ChapterReader({
  scenes,
}: {
  scenes: { id: string; title: string; content: DocNode | null }[];
}) {
  const mergedDoc: DocNode = {
    type: "doc",
    content: scenes.flatMap((scene, i) => {
      const heading: DocNode = {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: scene.title }],
      };
      const body = scene.content?.content ?? [{ type: "paragraph" }];
      const separator: DocNode[] = i === 0 ? [] : [
        {
          type: "paragraph",
          content: [{ type: "text", text: "* * *" }],
        },
      ];
      return [...separator, heading, ...body];
    }),
  };

  const editor = useEditor({
    extensions: [StarterKit, ...ALL_TAG_MARKS],
    content: mergedDoc,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-3xl mx-auto focus:outline-none font-serif text-lg leading-relaxed",
      },
    },
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-12 bg-zinc-50">
      <EditorContent editor={editor} />
    </div>
  );
}
