import type { MetadataRoute } from "next";

// PWA install manifest. `display: standalone` makes the installed app open without
// browser chrome; `start_url` lands signed-in users in the app. Icons currently reuse
// the app's SVG; dedicated maskable PNG app icons + splash screens are a design TODO
// (tracked with the wood/paper theme art).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Writer's Cube",
    short_name: "Writer's Cube",
    description: "Your writing, always with you. Draft, capture, and sync across every device.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3ee",
    theme_color: "#3a3327",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
