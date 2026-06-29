"use client";

import { useEffect, useState } from "react";

/**
 * Height (px) currently covered by the on-screen keyboard, so the mobile editor
 * toolbar can sit just above it instead of hiding underneath.
 *
 * Two sources, dependency-free:
 *   1. `visualViewport` (all modern mobile browsers + the Capacitor web view):
 *      when the keyboard opens, the visual viewport shrinks; the gap between it
 *      and the layout viewport is the keyboard height. This is the primary path
 *      and needs no plugins.
 *   2. The Capacitor Keyboard plugin's `keyboardWillShow` / `keyboardWillHide`
 *      window events, if the native shell dispatches them. We listen for them
 *      opportunistically (no static import) for a crisper native value.
 *
 * Returns 0 on the server, on desktop, and whenever the keyboard is closed.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;

    const fromViewport = () => {
      if (!vv) return;
      // Gap between layout viewport bottom and the (shrunken) visual viewport.
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(gap > 60 ? Math.round(gap) : 0);
    };

    fromViewport();
    vv?.addEventListener("resize", fromViewport);
    vv?.addEventListener("scroll", fromViewport);

    // Opportunistic native signal from @capacitor/keyboard, if present.
    type KbEvent = CustomEvent<{ keyboardHeight?: number }>;
    const onShow = (e: Event) => {
      const h = (e as KbEvent).detail?.keyboardHeight;
      if (typeof h === "number" && h > 0) setInset(Math.round(h));
    };
    const onHide = () => setInset(0);
    window.addEventListener("keyboardWillShow", onShow as EventListener);
    window.addEventListener("keyboardWillHide", onHide as EventListener);

    return () => {
      vv?.removeEventListener("resize", fromViewport);
      vv?.removeEventListener("scroll", fromViewport);
      window.removeEventListener("keyboardWillShow", onShow as EventListener);
      window.removeEventListener("keyboardWillHide", onHide as EventListener);
    };
  }, []);

  return inset;
}
