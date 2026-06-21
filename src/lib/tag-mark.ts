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
    customTag: {
      setCustomTag: (attrs: { label: string; color: string }) => ReturnType;
      unsetCustomTag: () => ReturnType;
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

/**
 * A single mark for user-defined custom tags. Carries the label + color as
 * attributes (both non-empty, so they round-trip through ProseMirror's toJSON).
 */
export const CustomTag = Mark.create({
  name: "customTag",
  inclusive: false,
  excludes:
    "tagLookup tagRevise tagWeak tagFactcheck tagPlaceholder customTag",

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? "",
        renderHTML: (attrs) => ({ "data-label": attrs.label as string }),
      },
      color: {
        default: "#8a7a96",
        parseHTML: (el) => el.getAttribute("data-color") ?? "#8a7a96",
        renderHTML: (attrs) => ({ "data-color": attrs.color as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-custom-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const color = (HTMLAttributes["data-color"] as string) ?? "#8a7a96";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-custom-tag": "true",
        class: "wc-tag wc-tag-custom",
        style: `--wc-custom: ${color};`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCustomTag:
        (attrs: { label: string; color: string }) =>
        ({ commands }: { commands: { setMark: (n: string, a: unknown) => boolean } }) =>
          commands.setMark("customTag", attrs),
      unsetCustomTag:
        () =>
        ({ commands }: { commands: { unsetMark: (n: string) => boolean } }) =>
          commands.unsetMark("customTag"),
    } as never;
  },
});

export const TAG_MARK_NAMES: Record<TagKind, string> = {
  lookup: "tagLookup",
  revise: "tagRevise",
  weak: "tagWeak",
  factcheck: "tagFactcheck",
  placeholder: "tagPlaceholder",
};

export const ALL_TAG_MARKS = [
  TagLookup,
  TagRevise,
  TagWeak,
  TagFactcheck,
  TagPlaceholder,
  CustomTag,
];
