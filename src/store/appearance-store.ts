"use client";

import { useSyncExternalStore } from "react";

export type Theme = "mist" | "dusk" | "clay";
export type Motion = "dynamic" | "static";

export const THEMES: { id: Theme; label: string; hint: string; swatch: string[] }[] = [
  { id: "mist", label: "Mist", hint: "Cool & calm (default)", swatch: ["#edeeeb", "#5e7488", "#87a08f"] },
  { id: "dusk", label: "Dusk", hint: "Dark mode", swatch: ["#1b1e23", "#7f99af", "#9c92ad"] },
  { id: "clay", label: "Clay", hint: "Warm earth", swatch: ["#f2eee6", "#c07a63", "#8aa791"] },
];

const THEME_KEY = "wc-theme";
const MOTION_KEY = "wc-motion";
const DEFAULT_THEME: Theme = "mist";
const DEFAULT_MOTION: Motion = "dynamic";

// Appearance state lives on <html data-theme/data-motion> (set pre-paint by the
// inline script in the root layout). We treat those attributes as the external
// store: read via getSnapshot, write through to the DOM + localStorage on change.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emit() {
  listeners.forEach((l) => l());
}

function readTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || DEFAULT_THEME;
}
function readMotion(): Motion {
  return (document.documentElement.dataset.motion as Motion) || DEFAULT_MOTION;
}

export function useAppearance() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const motion = useSyncExternalStore(subscribe, readMotion, () => DEFAULT_MOTION);

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    emit();
  }
  function setMotion(next: Motion) {
    document.documentElement.dataset.motion = next;
    try {
      localStorage.setItem(MOTION_KEY, next);
    } catch {}
    emit();
  }

  return { theme, motion, setTheme, setMotion };
}
