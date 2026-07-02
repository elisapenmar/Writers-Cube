"use client";

import { useEffect, useRef } from "react";
import { onOnlineChange } from "./online-state";

/**
 * Run a callback whenever connectivity returns. The editors use this to retry
 * their last failed autosave: offline typing is held safely in the local Yjs
 * mirror, but the durable JSONB save fails while offline, and without a retry
 * the server (and any non-Yjs client, e.g. desktop web) keeps the stale copy
 * until the writer happens to type again.
 *
 * The callback ref is kept current so the subscription itself never re-binds.
 */
export function useOnReconnect(fn: () => void): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => onOnlineChange((online) => {
    if (online) ref.current();
  }), []);
}
