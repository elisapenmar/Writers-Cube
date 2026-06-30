"use client";

import { useOrganize } from "@/store/organize-store";
import { BrainstormPanel } from "@/components/brainstorm-panel";

export function BrainstormSidePanel() {
  const bsOpen = useOrganize((s) => s.bsOpen);
  const bsPinned = useOrganize((s) => s.bsPinned);
  const bsWidth = useOrganize((s) => s.bsWidth);
  const navCollapsed = useOrganize((s) => s.navCollapsed);
  const setBsOpen = useOrganize((s) => s.setBsOpen);
  const toggleBsPin = useOrganize((s) => s.toggleBsPin);
  const setBsWidth = useOrganize((s) => s.setBsWidth);

  const visible = bsOpen || bsPinned;
  if (!visible) return null;

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = bsWidth;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      setBsWidth(startWidth + dx);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const leftOffset = navCollapsed ? 48 : 288; // w-12 vs w-72

  return (
    <aside
      className="wc-bs-panel fixed inset-y-0 z-30 bg-[var(--wc-surface)] border-r border-[var(--wc-border)] flex flex-col shadow-2xl"
      style={{ left: `${leftOffset}px`, width: `${bsWidth}px`, maxWidth: "95vw" }}
    >
      <header className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-3 gap-2">
        <h2 className="font-serif text-base">Brainstorm</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleBsPin}
            className={`rounded-md px-2 py-1 text-xs border ${
              bsPinned
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
            }`}
            title={bsPinned ? "Unpin" : "Pin to side (keeps visible across pages)"}
          >
            {bsPinned ? "Pinned" : "Pin"}
          </button>
          <button
            onClick={() => {
              setBsOpen(false);
              if (bsPinned) useOrganize.setState({ bsPinned: false });
            }}
            className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] text-lg leading-none px-1"
            title="Close"
          >
            ×
          </button>
        </div>
      </header>

      <BrainstormPanel />

      {/* Resize handle on right edge */}
      <div
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 right-0 w-1.5 translate-x-1/2 cursor-col-resize hover:bg-[var(--wc-stone)] active:bg-[var(--wc-stone)] z-40"
        title="Drag to resize"
      />
    </aside>
  );
}
