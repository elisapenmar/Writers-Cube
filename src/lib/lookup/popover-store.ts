// Module-level bridge between the editor context-menu items and the floating
// lookup popover. The menu's `run` fires AFTER the context menu has closed, so
// the popover can't be a child of the menu; instead an always-mounted
// `<LookupPopoverHost/>` (in the writing layout) subscribes here and a menu item
// calls `openLookupPopover(...)` to show it. This mirrors the Smart Text registry
// pattern (`@/lib/story-elements`): a tiny store with a single subscriber.

/** Which lookup the popover should run when it opens. */
export type LookupMode = "define" | "thesaurus";

/** Where to anchor the floating card (viewport coordinates, in px). */
export type LookupAnchor = { x: number; y: number };

export type LookupRequest = {
  mode: LookupMode;
  word: string;
  anchor: LookupAnchor;
  /** Replace the looked-up word in the document (thesaurus synonym click). */
  onReplace?: (replacement: string) => void;
};

type Listener = (req: LookupRequest | null) => void;

let listener: Listener | null = null;
let current: LookupRequest | null = null;

/** The host registers itself here. Only one host is expected (the layout one). */
export function setLookupPopoverListener(fn: Listener | null): void {
  listener = fn;
  // Replay the current request so a host that mounts late still shows it.
  if (fn && current) fn(current);
}

/** Open (or replace) the lookup popover. Called from a menu item's `run`. */
export function openLookupPopover(req: LookupRequest): void {
  current = req;
  listener?.(req);
}

/** Close the popover. */
export function closeLookupPopover(): void {
  current = null;
  listener?.(null);
}
