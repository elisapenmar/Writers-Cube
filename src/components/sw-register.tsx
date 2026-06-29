"use client";

import { useEffect } from "react";

/**
 * Registers the hand-rolled service worker (`public/sw.js`) that makes the app
 * installable and able to open offline to a cached shell. Registration is a
 * no-op in development so Turbopack/HMR are never served stale from cache; the
 * worker only takes over in production builds.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[wc] service worker registration failed", err);
      });
    };

    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
