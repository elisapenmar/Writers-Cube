/**
 * CubeMark, a small, presentational faceted-cube logo mark.
 *
 * Three rhombus faces in the muted slate / sage / plum brand tones give a calm,
 * cubism-inflected glyph. Decorative only (aria-hidden); pair with a text label.
 *
 * The brand colors are fixed (not theme variables) so the Writer's Cube logo
 * stays identical no matter which app theme the writer has chosen.
 */
const LOGO_TOP = "#5f7a68"; // sage
const LOGO_LEFT = "#566b7e"; // slate
const LOGO_RIGHT = "#665f77"; // plum

export function CubeMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* top face, lightest */}
      <path d="M12 2.5 21 7l-9 4.5L3 7l9-4.5Z" fill={LOGO_TOP} opacity="0.92" />
      {/* left face, slate */}
      <path d="M3 7l9 4.5V21l-9-4.5V7Z" fill={LOGO_LEFT} opacity="0.92" />
      {/* right face, plum, slightly darker for depth */}
      <path d="M21 7l-9 4.5V21l9-4.5V7Z" fill={LOGO_RIGHT} opacity="0.82" />
    </svg>
  );
}
