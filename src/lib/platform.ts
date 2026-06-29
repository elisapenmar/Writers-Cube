/**
 * Shared runtime-platform primitive — the single import surface for all mobile
 * work (offline/sync, mobile UI, monetization). Keep this signature stable so
 * the parallel Wave 1 streams can build against it without renegotiation.
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
 * Touch-first device — the native shell or a coarse-pointer browser. This is a
 * device-capability check, not a viewport/breakpoint check; responsive layout
 * decisions should layer a width-based hook on top of this.
 */
export function isMobile(): boolean {
  if (isNative()) return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}
