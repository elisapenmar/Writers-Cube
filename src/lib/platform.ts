// Shared platform primitive (Wave 0 contract).
//
// This is the single import surface every mobile stream uses to decide native
// vs. web and standalone (installed PWA / Capacitor shell) vs. browser tab.
//
// It is intentionally dependency-free: it does NOT statically import
// `@capacitor/core`, so the web build never needs Capacitor present. When the
// app runs inside the Capacitor shell, the global `window.Capacitor` object is
// injected by the native runtime and we read it at call time. If Wave 0 later
// lands the real `@capacitor/core`, this file can switch to importing it without
// changing the exported signature, so A/B/C do not need to renegotiate.
//
// Everything here is SSR-safe: each function guards `window` access so it can be
// called during server rendering (where it reports the web, non-standalone
// defaults).

type Platform = "ios" | "android" | "web";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the native Capacitor shell (iOS / Android app), not the web. */
export function isNative(): boolean {
  const cap = capacitor();
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

/** The host platform. Reports `web` in any browser (including mobile browsers). */
export function getPlatform(): Platform {
  const cap = capacitor();
  const p = typeof cap?.getPlatform === "function" ? cap.getPlatform() : "web";
  return p === "ios" || p === "android" ? p : "web";
}

/**
 * True when the app is running as an installed app surface rather than a regular
 * browser tab: the native Capacitor shell, an "Add to Home Screen" PWA
 * (display-mode: standalone), or iOS Safari's legacy `navigator.standalone`.
 */
export function isStandalone(): boolean {
  if (isNative()) return true;
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  if (mql?.matches) return true;
  // iOS Safari predates display-mode: standalone for home-screen web apps.
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Coarse "is this a phone-sized / native mobile context" check, used together
 * with CSS breakpoints to pick the mobile-first UI. Returns true for the native
 * shell, and otherwise falls back to a viewport-width heuristic. Components that
 * need to react to width changes should use the `useIsMobile` hook (which listens
 * to a media query); this function is the one-shot, SSR-safe answer.
 */
export function isMobile(): boolean {
  if (isNative()) return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 767px)").matches ?? false;
}

/** The breakpoint (px) below which the mobile-first UI takes over. Phones and
 *  small tablets in portrait. Kept here so the hook and CSS stay in agreement. */
export const MOBILE_BREAKPOINT = 768;
