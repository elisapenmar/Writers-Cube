/**
 * Online/offline detection for the sync layer. Uses the browser's
 * `navigator.onLine` plus the `online`/`offline` events, which also fire inside
 * the Capacitor web view. (The @capacitor/network plugin could give a richer
 * connection type, but onLine is enough to decide "flush the outbox now" and
 * avoids a native-only code path; revisit if we need connection quality.)
 *
 * SSR-safe: reports online when there is no `navigator` so server renders never
 * show a misleading "offline" state.
 */

type Listener = (online: boolean) => void;

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  // navigator.onLine is conservative: false means definitely offline, true means
  // "has a network interface" (not a guarantee the server is reachable). Good
  // enough as the flush trigger; the actual replay still handles request errors.
  return navigator.onLine;
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe fn. No-op (returns
 * a noop unsubscribe) on the server.
 */
export function onOnlineChange(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const handleOnline = () => listener(true);
  const handleOffline = () => listener(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
