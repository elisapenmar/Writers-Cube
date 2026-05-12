import { TAG_KINDS, type TagKind } from "@/lib/tags";
import { TAG_MARK_NAMES } from "@/lib/tag-mark";

type Node = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: { kind?: string } }[];
  content?: Node[];
};

export type TaggedPassage = {
  kind: TagKind;
  /** Full sentence containing the tag (editable on the Tags page) */
  sentence: string;
  /** Offsets of the tagged subspan WITHIN `sentence` (for pill rendering) */
  tagOffsetInSentence: number;
  tagLengthInSentence: number;
  /** Index of the containing paragraph/heading/blockquote-leaf in doc traversal order */
  blockIndex: number;
  /** Character offsets of the SENTENCE within the block (for sentence-level rewrite) */
  sentenceStart: number;
  sentenceEnd: number;
};

const MARK_NAME_TO_KIND = new Map<string, TagKind>(
  (Object.entries(TAG_MARK_NAMES) as [TagKind, string][]).map(
    ([kind, name]) => [name, kind],
  ),
);

function kindForMark(markType: string): TagKind | null {
  if (markType === "tag") return "lookup"; // legacy single-mark tags
  return MARK_NAME_TO_KIND.get(markType) ?? null;
}

/**
 * Find the [start, end) offsets of the sentence containing position [tagStart, tagEnd)
 * within the given paragraph text. A sentence boundary is `.!?` followed by whitespace
 * or end-of-string; the block start and block end are also implicit boundaries.
 */
function sentenceBounds(
  paragraphText: string,
  tagStart: number,
  tagEnd: number,
): { start: number; end: number } {
  let start = 0;
  const enderRegex = /[.!?](?:["')\]]*)(\s+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = enderRegex.exec(paragraphText))) {
    const enderEnd = match.index + match[0].length;
    if (enderEnd <= tagStart) {
      start = enderEnd;
    } else {
      break;
    }
  }
  let end = paragraphText.length;
  enderRegex.lastIndex = tagEnd;
  const afterMatch = enderRegex.exec(paragraphText);
  if (afterMatch) {
    end = afterMatch.index + 1; // include the period/!/?
  }
  return { start, end };
}

export function extractTags(doc: unknown): TaggedPassage[] {
  if (!doc || typeof doc !== "object") return [];
  const out: TaggedPassage[] = [];
  let blockIndex = -1;

  type Run = { kind: TagKind; start: number; end: number };

  const visitBlock = (block: Node) => {
    blockIndex += 1;
    const myBlockIndex = blockIndex;
    if (!Array.isArray(block.content)) return;

    let paragraphText = "";
    const runs: Run[] = [];
    let current: Run | null = null;

    for (const child of block.content) {
      if (child.type !== "text") {
        // Treat inline non-text nodes (e.g. hardBreak) as a break in runs.
        if (current) {
          runs.push(current);
          current = null;
        }
        paragraphText += child.type === "hardBreak" ? "\n" : "";
        continue;
      }

      const tagMark = child.marks?.find((m) => kindForMark(m.type) !== null);
      const kind = tagMark ? kindForMark(tagMark.type) : null;
      const text = child.text ?? "";
      const start = paragraphText.length;
      paragraphText += text;
      const end = paragraphText.length;

      if (kind && (TAG_KINDS as readonly string[]).includes(kind)) {
        if (current && current.kind === kind) {
          current.end = end;
        } else {
          if (current) runs.push(current);
          current = { kind, start, end };
        }
      } else if (current) {
        runs.push(current);
        current = null;
      }
    }
    if (current) runs.push(current);

    for (const run of runs) {
      if (paragraphText.slice(run.start, run.end).trim() === "") continue;
      const { start: sStart, end: sEnd } = sentenceBounds(
        paragraphText,
        run.start,
        run.end,
      );
      const sentence = paragraphText.slice(sStart, sEnd);
      const tagOffsetInSentence = Math.max(0, run.start - sStart);
      const tagLengthInSentence = Math.min(sentence.length - tagOffsetInSentence, run.end - run.start);
      out.push({
        kind: run.kind,
        sentence,
        tagOffsetInSentence,
        tagLengthInSentence,
        blockIndex: myBlockIndex,
        sentenceStart: sStart,
        sentenceEnd: sEnd,
      });
    }
  };

  const walk = (node: Node) => {
    // Treat any block-level node with inline content as a paragraph for context.
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote"
    ) {
      // For blockquote, descend further — its content is paragraphs.
      if (node.type === "blockquote" && Array.isArray(node.content)) {
        node.content.forEach(walk);
        return;
      }
      visitBlock(node);
      return;
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };

  walk(doc as Node);
  return out;
}
