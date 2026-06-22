import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Quill",
  description: "Writer's Cube — V0.5",
};

// Applied before paint so the chosen theme/motion never flashes the default.
const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement;d.dataset.theme=localStorage.getItem('wc-theme')||'mist';d.dataset.motion=localStorage.getItem('wc-motion')||'dynamic';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="mist" data-motion="dynamic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        {/* Per-theme display faces: Playfair (Sherbet), Patua One slab (Clay). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Patua+One&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--wc-canvas)] text-[var(--wc-ink)]">
        {children}
      </body>
    </html>
  );
}
