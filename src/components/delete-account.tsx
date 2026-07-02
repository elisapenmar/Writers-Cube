"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/server/account";

/**
 * Two-step, type-to-confirm account deletion for the account menu. Apple
 * requires in-app account deletion when accounts exist; this is also the web
 * app's self-serve data-deletion path. The confirm step links the one-off JSON
 * backup (free tier data portability) before the point of no return.
 */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-[var(--wc-r-md)] px-3 py-2 text-left text-sm text-[var(--wc-faint)] transition hover:bg-[var(--wc-paper)] hover:text-red-700"
      >
        Delete account…
      </button>
    );
  }

  return (
    <div className="rounded-[var(--wc-r-md)] border border-red-200 bg-red-50/60 p-2.5">
      <p className="text-xs leading-relaxed text-red-900">
        This permanently deletes your account and all of your writing — projects,
        scenes, story bibles, everything. It cannot be undone.
      </p>
      <a
        href="/app/backup"
        className="mt-1.5 inline-block text-xs font-medium text-[var(--wc-ink)] underline"
      >
        Download a backup first
      </a>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder='Type "DELETE" to confirm'
        className="mt-2 w-full rounded-[var(--wc-r-sm)] border border-red-300 bg-white px-2 py-1.5 text-sm text-[var(--wc-ink)] outline-none placeholder:text-[var(--wc-faint)]"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          disabled={phrase !== "DELETE" || pending}
          onClick={() =>
            start(async () => {
              try {
                await deleteAccount();
              } catch (e) {
                // redirect() throws control flow internally; anything else is a
                // real failure worth surfacing.
                if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) {
                  setError(e.message);
                }
              }
            })
          }
          className="flex-1 rounded-[var(--wc-r-sm)] bg-red-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setPhrase("");
            setError(null);
          }}
          className="rounded-[var(--wc-r-sm)] border border-[var(--wc-border-strong)] px-2 py-1.5 text-xs text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
