/**
 * Shared runtime-platform primitive — the single import surface for all mobile
 * work (offline/sync, mobile UI, monetization). Keep this signature stable so
 * the parallel streams can build against it without renegotiation.
 *
 * Every accessor is SSR-safe: `@capacitor/core` returns "web" / false when no
 * native bridge is present (including during server rendering), and all
 * `window`/`navigator` reads are guarded.
 */
import { Capacitor } from "@capacitor/core";

export type Platform = "ios" | "android" | "web";

/** Running inside the Capacitor native shell (iOS/Android app), not a browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Concrete runtime: "ios" | "android" in the native shell, else "web". */
export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}

/**
 * App is running "installed": native shell, an installed PWA (display-mode
 * standalone), or iOS Safari "Add to Home Screen" (legacy navigator.standalone).
 */
export function isStandalone(): boolean {
  if (isNative()) return true;
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosHomeScreen =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(displayMode || iosHomeScreen);
}

/**
 * The breakpoint (px) below which the mobile-first UI takes over. Phones and
 * small tablets in portrait. Kept here so the `useIsMobile` hook and the CSS
 * media queries stay in agreement.
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Coarse "is this a phone-sized / native mobile context" check, used together
 * with CSS breakpoints to pick the mobile-first UI. True for the native shell,
 * otherwise a viewport-width heuristic. Components that need to react to width
 * changes should use the `useIsMobile` hook (it listens to a media query); this
 * function is the one-shot, SSR-safe answer.
 */
export function isMobile(): boolean {
  if (isNative()) return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches ?? false;
}
