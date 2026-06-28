"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Real "Paged" pagination. Instead of painting page seams at fixed intervals over
 * continuously-flowing text (which bisects lines), this measures the rendered
 * top-level blocks and inserts a page-break widget *before* any block that would
 * overflow the current page. Content keeps flowing in one column — blocks are
 * never split mid-line — and each widget renders the white page bottom, the desk-
 * coloured gap, and the next page's top margin.
 *
 * Inert unless the editor sits inside a `[data-paged="true"]` ancestor, so it is
 * safe to include in every editor's extension set. All geometry is computed in
 * inches (via a measured 1in reference) so it is correct at any page zoom.
 */
const KEY = new PluginKey<DecorationSet>("pagination");

const PAGE_H_IN = 11;
const MARGIN_IN = 1; // top & bottom page margins
const GAP_IN = 0.5; // desk gap shown between sheets
const CONTENT_IN = PAGE_H_IN - 2 * MARGIN_IN; // 9in usable height per page
const PX_PER_IN = 96; // logical px; CSS `zoom` scales the rendered widget

export const Pagination = Extension.create({
  name: "pagination",

  addProseMirrorPlugins() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSig = "";

    const run = (view: EditorView) => {
      timer = null;
      const result = compute(view);
      if (result.sig === lastSig) return; // stable — avoid a re-measure loop
      lastSig = result.sig;
      view.dispatch(view.state.tr.setMeta(KEY, result.set).setMeta("addToHistory", false));
    };

    return [
      new Plugin<DecorationSet>({
        key: KEY,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(KEY) as DecorationSet | undefined;
            if (meta !== undefined) return meta;
            return old.map(tr.mapping, tr.doc);
          },
        },
        view(view) {
          // setTimeout (not rAF): rAF is paused in background tabs, so the first
          // measure could be skipped until the tab is focused.
          const schedule = () => {
            if (!timer) timer = setTimeout(() => run(view), 60);
          };
          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          schedule();
          return {
            update: () => schedule(),
            destroy: () => {
              ro.disconnect();
              if (timer) clearTimeout(timer);
              timer = null;
            },
          };
        },
        props: {
          decorations: (state) => KEY.getState(state),
        },
      }),
    ];
  },
});

function compute(view: EditorView): { set: DecorationSet; sig: string } {
  const host = view.dom as HTMLElement;
  const paged = host.closest('[data-paged="true"]');
  // Multi-column blocks + pagination is out of scope: bail to no breaks.
  if (!paged || host.querySelector("[data-columns]")) {
    return { set: DecorationSet.empty, sig: "" };
  }

  // px-per-inch in the current (possibly zoomed) render, so block heights convert
  // to zoom-independent inches.
  const ref = document.createElement("div");
  ref.style.cssText = "position:absolute;height:1in;width:1px;visibility:hidden;pointer-events:none;";
  host.appendChild(ref);
  const pxPerIn = ref.getBoundingClientRect().height || PX_PER_IN;
  host.removeChild(ref);

  const decos: Decoration[] = [];
  const sigParts: string[] = [];
  let used = 0; // inches of content used on the current page

  view.state.doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset) as HTMLElement | null;
    let h = 0;
    if (dom && dom.getBoundingClientRect) {
      const r = dom.getBoundingClientRect();
      const cs = getComputedStyle(dom);
      h = (r.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0)) / pxPerIn;
    }
    if (used > 0 && used + h > CONTENT_IN) {
      const remaining = CONTENT_IN - used; // white left at the page bottom
      const fillIn = remaining + 2 * MARGIN_IN + GAP_IN;
      const deskTopIn = remaining + MARGIN_IN;
      decos.push(
        Decoration.widget(offset, () => makeBreak(fillIn, deskTopIn), {
          side: -1,
          key: `pb-${offset}-${Math.round(fillIn * 100)}`,
        }),
      );
      sigParts.push(`${offset}:${Math.round(fillIn * 100)}`);
      used = 0;
    }
    used += h;
  });

  return { set: DecorationSet.create(view.state.doc, decos), sig: sigParts.join("|") };
}

function makeBreak(fillIn: number, deskTopIn: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "wc-page-break";
  el.setAttribute("aria-hidden", "true");
  el.contentEditable = "false";
  el.style.height = `${fillIn * PX_PER_IN}px`;
  const gap = document.createElement("div");
  gap.className = "wc-page-gap";
  gap.style.top = `${deskTopIn * PX_PER_IN}px`;
  gap.style.height = `${GAP_IN * PX_PER_IN}px`;
  el.appendChild(gap);
  return el;
}
