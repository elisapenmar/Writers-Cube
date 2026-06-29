"use client";

import { useFormStatus } from "react-dom";

/**
 * Overlay shown on a project card while its "open" form action is running.
 * useFormStatus stays pending through the server action and the navigation that
 * follows, so this covers the full open-a-project delay. Drop it inside the
 * <form action={openProject}>; the nearest positioned ancestor (the card) bounds it.
 */
export function OpenPending() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <span className="wc-open-pending" role="status" aria-live="polite">
      <span className="wc-spinner" aria-hidden="true" />
      Opening…
    </span>
  );
}
