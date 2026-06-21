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
      </head>
      <body className="min-h-full flex flex-col bg-[var(--wc-canvas)] text-[var(--wc-ink)]">
        {children}
      </body>
    </html>
  );
}
