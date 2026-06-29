import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor uses the **remote-URL pattern**: the native shell is a thin wrapper
 * whose web view loads the live hosted Next.js app (server actions, server
 * components, and auth middleware need a Node server, so the app cannot be
 * statically bundled). Feature/content updates then ship the instant you deploy
 * to Vercel — the native shell only needs rebuilding when native bits change.
 *
 * `webDir` ("public") is just the bundled fallback Capacitor requires; at
 * runtime `server.url` takes over.
 *
 * Dev note: to point the shell at a local machine instead of prod, set
 * `server.url` to `http://<your-LAN-IP>:3000` and add
 * `server.cleartext: true` (Android allows http only when cleartext is on).
 */
const config: CapacitorConfig = {
  appId: "com.writerscube.app",
  appName: "Writer's Cube",
  webDir: "public",
  server: {
    url: "https://writers-cube.vercel.app",
    androidScheme: "https",
  },
};

export default config;
