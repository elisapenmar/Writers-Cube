"use client";

import { useEffect } from "react";

/**
 * Registers the hand-rolled service worker (`public/sw.js`) that makes the app
 * installable and able to open offline to a cached shell. Registration is a
 * no-op in development so Turbopack/HMR are never served stale from cache; the
 * worker only takes over in production builds.
 *
 * It also warms the dashboard's navigation payload once the worker is active:
 * a writer who wants to jot down a story kernel offline must be able to reach
 * the dashboard even if they have not visited it this session. The `RSC: 1`
 * header makes Next return the client-navigation payload, which the worker
 * caches under `/app` (redirects — e.g. signed-out — are skipped by the SW, so
 * warming from the login page caches nothing).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          if (navigator.onLine) {
            fetch("/app?_rsc=warm", { headers: { RSC: "1" } }).catch(() => {});
          }
        })
        .catch((err) => {
          console.error("[wc] service worker registration failed", err);
        });
    };

    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
