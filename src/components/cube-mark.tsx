/**
 * CubeMark — a small, presentational faceted-cube logo mark.
 *
 * Three rhombus faces in the muted slate / sage / plum brand tones give a calm,
 * cubism-inflected glyph. Decorative only (aria-hidden); pair with a text label.
 */
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
      {/* top face — lightest */}
      <path
        d="M12 2.5 21 7l-9 4.5L3 7l9-4.5Z"
        fill="var(--wc-sage)"
        opacity="0.92"
      />
      {/* left face — slate */}
      <path
        d="M3 7l9 4.5V21l-9-4.5V7Z"
        fill="var(--wc-slate)"
        opacity="0.92"
      />
      {/* right face — plum, slightly darker for depth */}
      <path
        d="M21 7l-9 4.5V21l9-4.5V7Z"
        fill="var(--wc-plum)"
        opacity="0.82"
      />
    </svg>
  );
}
