"use client";

import { useTransition } from "react";
import { createLooseScene } from "@/server/loose";

/**
 * Capture-first fast path for mobile.
 *
 * One tap creates a fresh loose scene and drops the writer straight into the
 * editor with the caret ready. `createLooseScene` inserts the row and redirects
 * to `/app/loose/{id}` server-side, so there is no intermediate screen: from a
 * cold app open, the tab-bar Capture button to a blinking cursor is a single
 * round trip (target: under ~10 seconds).
 *
 * Rendered as the center action of the mobile tab bar (`variant="fab"`) and also
 * offered as a large primary button on empty/landing states (`variant="block"`).
 */
export function MobileQuickCapture({
  projectId,
  variant = "fab",
}: {
  projectId: string;
  variant?: "fab" | "block";
}) {
  const [pending, start] = useTransition();

  function capture() {
    start(async () => {
      try {
        await createLooseScene(projectId);
      } catch {
        // redirect() throws control-flow internally; a real failure leaves the
        // writer on the current screen, which is the safe default.
      }
    });
  }

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={capture}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--wc-r-md)] bg-[var(--wc-slate)] px-4 py-3.5 text-base font-medium text-[var(--wc-on-accent)] active:opacity-90 disabled:opacity-60"
      >
        <PencilPlus />
        {pending ? "Opening." : "Quick capture"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={capture}
      disabled={pending}
      aria-label="Quick capture a new loose scene"
      className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-[var(--wc-slate)] text-[var(--wc-on-accent)] shadow-[var(--wc-shadow-md)] active:opacity-90 disabled:opacity-60"
    >
      {pending ? <Spinner /> : <PencilPlus size={24} />}
    </button>
  );
}

function PencilPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
