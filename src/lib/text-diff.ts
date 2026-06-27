/** Extract readable plain text from Tiptap JSON (or a plain string). */
export function toPlainText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[]; role?: string };
    if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
    if (typeof node.role === "string" && typeof node.text === "string") {
      parts.push(`${node.role}: ${node.text}`);
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  if (Array.isArray(value)) value.forEach(walk);
  else walk(value);
  return parts.join(" ").trim();
}

export type DiffSegment = { type: "equal" | "insert" | "delete"; text: string };

/** Word tokens plus the whitespace between them, so the diff reassembles cleanly. */
function tokenizeWords(s: string): string[] {
  return s.match(/\s+|\S+/g) ?? [];
}

/** Sentence/line-sized chunks — a coarser fallback that keeps huge texts cheap. */
function tokenizeCoarse(s: string): string[] {
  return s.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [];
}

/** Longest-common-subsequence diff over token arrays, with the actual alignment
 *  recovered by backtracking. Uses a flat Int32Array for the table. */
function diffTokens(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    const row = i * w;
    const next = (i + 1) * w;
    for (let j = m - 1; j >= 0; j--) {
      dp[row + j] =
        a[i] === b[j]
          ? dp[next + j + 1] + 1
          : Math.max(dp[next + j], dp[row + j + 1]);
    }
  }

  const segs: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += text;
    else segs.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      push("delete", a[i]); // present in `old` (live) only
      i++;
    } else {
      push("insert", b[j]); // present in `new` (recovered) only
      j++;
    }
  }
  while (i < n) push("delete", a[i++]);
  while (j < m) push("insert", b[j++]);
  return segs;
}

/**
 * Redline diff between two plain-text strings. `oldText` is the baseline (the
 * currently-live version) and `newText` is the candidate (the recovered edit):
 * `insert` segments exist only in `newText`, `delete` segments only in `oldText`.
 * Falls back to sentence-level granularity for very large inputs to bound cost.
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  let a = tokenizeWords(oldText);
  let b = tokenizeWords(newText);
  if (a.length * b.length > 4_000_000) {
    a = tokenizeCoarse(oldText);
    b = tokenizeCoarse(newText);
  }
  return diffTokens(a, b);
}
