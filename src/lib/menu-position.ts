"use client";

import { useCallback } from "react";

/**
 * Keep a floating (position: fixed) menu fully on-screen. Returns a callback
 * ref: attach it to the menu element and it measures the rendered box during
 * commit (before paint) and sets `left`/`top` imperatively from the anchor
 * point (the click coordinates) — flipping up/left when the menu would overflow
 * and pinning to an 8px margin (letting the menu's own scroll take over) when
 * it is taller than the viewport. Pass `null` coords while the menu is closed.
 *
 * Position is applied to the node's style rather than React state so it neither
 * calls setState in an effect nor reads a ref during render, and so unrelated
 * re-renders while the menu is open don't reset it.
 */
export function useClampedMenuPosition(x: number | null, y: number | null) {
  return useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || x == null || y == null) return;
      const { width, height } = node.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = x;
      if (left + width > vw - margin) left = x - width; // flip left of the click
      left = Math.max(margin, Math.min(left, vw - margin - width));

      let top = y;
      if (top + height > vh - margin) top = y - height; // flip above the click
      top = Math.max(margin, Math.min(top, vh - margin - height));

      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    },
    [x, y],
  );
}
