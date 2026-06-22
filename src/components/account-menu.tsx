"use client";

import { useState } from "react";
import { signOut } from "@/server/scenes";
import {
  useAppearance,
  THEMES,
  type Motion,
} from "@/store/appearance-store";

function initials(email: string | null): string {
  if (!email) return "✎";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || name.slice(0, 2)).toUpperCase();
}

const MOTIONS: { id: Motion; label: string; hint: string }[] = [
  { id: "dynamic", label: "Dynamic", hint: "Cubes drift & fall" },
  { id: "static", label: "Static", hint: "A still scatter" },
];

export function AccountMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const { theme, motion, setTheme, setMotion } = useAppearance();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account and appearance"
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-[var(--wc-on-accent)] shadow-[var(--wc-shadow-sm)] transition hover:brightness-105"
        style={{ background: "var(--wc-slate)" }}
      >
        {initials(email)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-[var(--wc-r-lg)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 shadow-[var(--wc-shadow-md)]">
            {/* Account */}
            <div className="flex items-center gap-3 px-1 pb-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[var(--wc-on-accent)]"
                style={{ background: "var(--wc-slate)" }}
              >
                {initials(email)}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--wc-faint)]">
                  Signed in
                </div>
                <div className="truncate text-sm text-[var(--wc-ink)]">
                  {email ?? "Your account"}
                </div>
              </div>
            </div>

            {/* Style */}
            <div className="rounded-[var(--wc-r-md)] border border-[var(--wc-border)] p-2.5">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--wc-faint)]">
                Style
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.hint}
                    data-active={theme === t.id}
                    className="group rounded-[var(--wc-r-sm)] border p-1.5 text-left transition data-[active=true]:border-[var(--wc-slate)]"
                    style={{ borderColor: theme === t.id ? "var(--wc-slate)" : "var(--wc-border)" }}
                  >
                    <span className="flex gap-0.5">
                      {t.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="h-4 flex-1 rounded-[3px]"
                          style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
                        />
                      ))}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--wc-muted)]">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--wc-faint)]">
                Background
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {MOTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMotion(m.id)}
                    title={m.hint}
                    className="rounded-[var(--wc-r-sm)] border px-2 py-1.5 text-xs transition"
                    style={{
                      borderColor: motion === m.id ? "var(--wc-slate)" : "var(--wc-border)",
                      color: motion === m.id ? "var(--wc-ink)" : "var(--wc-muted)",
                      background: motion === m.id ? "color-mix(in srgb, var(--wc-slate) 10%, transparent)" : "transparent",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sign out */}
            <form action={signOut} className="mt-2">
              <button
                type="submit"
                className="w-full rounded-[var(--wc-r-md)] px-3 py-2 text-left text-sm text-[var(--wc-muted)] transition hover:bg-[var(--wc-paper)] hover:text-[var(--wc-ink)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
