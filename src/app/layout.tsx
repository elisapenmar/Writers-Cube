import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  applicationName: "Writer's Cube",
  title: "Writer's Cube",
  description: "Writer's Cube, V0.5",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Writer's Cube",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Match the default (mist) canvas tone so the mobile status bar blends in.
  themeColor: "#edeeeb",
  // Let the app paint under the notch/home indicator on phones.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // Intentionally NOT capping maximum-scale — pinch-zoom must stay available (a11y).
};

// Applied before paint so the chosen theme/motion never flashes the default.
// (Also migrates the legacy "timber" theme id to its new name, "parchment".)
const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('wc-theme');if(t==='timber'){t='parchment';localStorage.setItem('wc-theme',t);}d.dataset.theme=t||'mist';d.dataset.motion=localStorage.getItem('wc-motion')||'dynamic';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="mist" data-motion="dynamic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        {/* Per-theme display faces: Ultra slab (Clay), Special Elite typewriter
            (Parchment), Pacifico script (Sherbet). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pacifico&family=Special+Elite&family=Ultra&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--wc-canvas)] text-[var(--wc-ink)]">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
