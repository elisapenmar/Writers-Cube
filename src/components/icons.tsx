// Rounded-square icon language for Writer's Cube — no chevrons.

export function SquareArrow({
  dir = "left",
  className = "",
}: {
  dir?: "left" | "right" | "up" | "down";
  className?: string;
}) {
  const rot = { left: 0, up: 90, right: 180, down: 270 }[dir];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.5"
        stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <path
        d="M9.5 5.5 L7 8 L9.5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`rotate(${rot} 8 8)`}
      />
    </svg>
  );
}

/** Sidebar collapse/expand glyph: a rounded square with a panel divider. */
export function SidebarToggle({
  collapsed = false,
  className = "",
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="1.25" y="2.25" width="13.5" height="11.5" rx="3.5"
        stroke="currentColor" strokeWidth="1.3" />
      <line
        x1={collapsed ? "5.5" : "6.5"}
        y1="2.25"
        x2={collapsed ? "5.5" : "6.5"}
        y2="13.75"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.7"
      />
    </svg>
  );
}

/** A small diamond that marks any AI-powered action. */
export function AiDiamond({ className = "", size = 12 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
    >
      <path
        d="M6 0.6 L11.4 6 L6 11.4 L0.6 6 Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path d="M6 3.2 L8.8 6 L6 8.8 L3.2 6 Z" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** Small rounded-cube emblem for brand accents. */
export function CubeMark({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 5.5 L8 8 L13.5 5.5 M8 8 V13.5" stroke="currentColor" strokeWidth="1.1"
        opacity="0.55" strokeLinejoin="round" />
    </svg>
  );
}
