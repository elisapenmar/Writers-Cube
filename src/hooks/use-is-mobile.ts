"use client";

import { useEffect, useState } from "react";
import { isNative, MOBILE_BREAKPOINT } from "@/lib/platform";

/**
 * Reactive "is this a phone-width / native context" hook.
 *
 * Drives the mobile-first UI: it returns true inside the native Capacitor shell
 * and below the mobile breakpoint, and updates live as the viewport crosses it
 * (e.g. when rotating a tablet or resizing a desktop window for testing).
 *
 * SSR / first-paint note: it starts `false` (the desktop default) so the server
 * and the first client render agree, then corrects after mount. Consumers that
 * must avoid a desktop flash should gate on `mounted` from `useMobileReady`.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (isNative()) {
      const setNative = () => setMobile(true);
      setNative();
      return;
    }
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}

/**
 * Like `useIsMobile`, but also reports whether the client has mounted so callers
 * can avoid rendering the wrong shell during hydration. Until `ready` is true,
 * treat the layout as indeterminate (render nothing layout-shifting).
 */
export function useMobileReady(): { mobile: boolean; ready: boolean } {
  const [ready, setReady] = useState(false);
  const mobile = useIsMobile();
  useEffect(() => {
    const markReady = () => setReady(true);
    markReady();
  }, []);
  return { mobile, ready };
}
