import { CubeMark } from "@/components/cube-mark";
import type { CSSProperties } from "react";

/**
 * CubeField — an ambient layer of muted cubes that slowly float and fall behind
 * the page content. Decorative only (pointer-events: none, aria-hidden).
 *
 * Configs are fixed (no randomness) so server and client render identically.
 * Negative delays start cubes mid-fall, so the field looks settled on load.
 */
const CUBES: {
  left: number; // %
  size: number; // px
  dur: number; // s — slow = floaty
  delay: number; // s — negative seeds mid-animation
  rot: number; // deg of drift-rotation
}[] = [
  { left: 4, size: 56, dur: 34, delay: -3, rot: 34 },
  { left: 13, size: 30, dur: 27, delay: -15, rot: -26 },
  { left: 24, size: 44, dur: 31, delay: -22, rot: 22 },
  { left: 34, size: 22, dur: 24, delay: -8, rot: -40 },
  { left: 45, size: 64, dur: 38, delay: -28, rot: 28 },
  { left: 55, size: 28, dur: 26, delay: -5, rot: -20 },
  { left: 64, size: 40, dur: 30, delay: -18, rot: 36 },
  { left: 73, size: 20, dur: 23, delay: -12, rot: -32 },
  { left: 82, size: 50, dur: 35, delay: -25, rot: 24 },
  { left: 90, size: 32, dur: 28, delay: -9, rot: -28 },
  { left: 96, size: 24, dur: 25, delay: -19, rot: 30 },
];

export function CubeField() {
  return (
    <div className="wc-cube-field" aria-hidden="true">
      {CUBES.map((c, i) => (
        <span
          key={i}
          className="wc-cube"
          style={
            {
              left: `${c.left}%`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              "--wc-cube-rot": `${c.rot}deg`,
            } as CSSProperties
          }
        >
          <CubeMark size={c.size} />
        </span>
      ))}
    </div>
  );
}
