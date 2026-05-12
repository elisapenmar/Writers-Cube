import { Mark, mergeAttributes } from "@tiptap/core";
import { type TagKind } from "@/lib/tags";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tagLookup: {
      toggleTagLookup: () => ReturnType;
    };
    tagRevise: {
      toggleTagRevise: () => ReturnType;
    };
    tagWeak: {
      toggleTagWeak: () => ReturnType;
    };
    tagFactcheck: {
      toggleTagFactcheck: () => ReturnType;
    };
    tagPlaceholder: {
      toggleTagPlaceholder: () => ReturnType;
    };
  }
}

function makeTagMark(kind: TagKind) {
  const cap = kind[0].toUpperCase() + kind.slice(1);
  const name = `tag${cap}` as const;
  const toggleName = `toggleTag${cap}` as const;

  return Mark.create({
    name,
    inclusive: false,
    excludes: "tagLookup tagRevise tagWeak tagFactcheck tagPlaceholder",

    parseHTML() {
      return [
        {
          tag: `span[data-tag][data-kind="${kind}"]`,
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-tag": "true",
          "data-kind": kind,
          class: "wc-tag",
        }),
        0,
      ];
    },

    addCommands() {
      return {
        [toggleName]: () =>
          ({ commands }: { commands: { toggleMark: (name: string) => boolean } }) =>
            commands.toggleMark(name),
      } as never;
    },
  });
}

export const TagLookup = makeTagMark("lookup");
export const TagRevise = makeTagMark("revise");
export const TagWeak = makeTagMark("weak");
export const TagFactcheck = makeTagMark("factcheck");
export const TagPlaceholder = makeTagMark("placeholder");

export const TAG_MARK_NAMES: Record<TagKind, string> = {
  lookup: "tagLookup",
  revise: "tagRevise",
  weak: "tagWeak",
  factcheck: "tagFactcheck",
  placeholder: "tagPlaceholder",
};

export const ALL_TAG_MARKS = [TagLookup, TagRevise, TagWeak, TagFactcheck, TagPlaceholder];
