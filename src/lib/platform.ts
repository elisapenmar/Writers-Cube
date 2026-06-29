// Shared platform-detection primitive. Every mobile-specific concern imports from here so the
// detection logic lives in exactly one place:
//   - mobile-first UI gating (show phone layouts / hide desktop-only chrome)
//   - reader-app billing gating (NEVER render purchase UI or payment links inside the iOS app)
//   - native-capability gating (push notifications, native share)
//
// Until Capacitor is installed it resolves to a web context. Once Capacitor's runtime is present
// it exposes the native bridge on `window.Capacitor`, which we read defensively so this module is
// safe to import on the server and in a plain browser.

export type Platform = "ios" | "android" | "web";

type CapacitorGlobal = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True when running inside the native Capacitor shell (iOS or Android app), false on the web. */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() ?? false;
}

/** Coarse platform: "ios" | "android" when in the native shell, otherwise "web". */
export function getPlatform(): Platform {
  const p = capacitor()?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return "web";
}

/** True when launched as an installed PWA (standalone display mode), incl. iOS Safari's flag. */
export function isInstalledPWA(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

/**
 * True when purchase UI / payment links must be hidden. Apple's reader-app rules forbid any
 * in-app purchase surface or link to external purchase inside the iOS app. Subscriptions are sold
 * on the web only; gate every upgrade/buy affordance behind `!hidePurchaseUI()`.
 */
export function hidePurchaseUI(): boolean {
  return getPlatform() === "ios";
}
