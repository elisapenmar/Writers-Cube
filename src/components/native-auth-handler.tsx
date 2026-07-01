"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNative } from "@/lib/platform";

/**
 * Native deep-link handler for OAuth. On the Capacitor shell, sign-in runs in the
 * system browser and returns via `com.writerscube.app://auth/callback?code=...`.
 * This listens for that deep link, exchanges the code for a session client-side
 * (the PKCE verifier lives in this web view), closes the system browser, and
 * reloads into the app so the Next.js middleware picks up the fresh session.
 *
 * No-op on the web (renders nothing, imports no Capacitor). Mounted once in the
 * root layout so it also catches the return while the user is still on /login.
 */
export function NativeAuthHandler() {
  useEffect(() => {
    if (!isNative()) return;

    let remove = () => {};
    void (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");
      const supabase = createClient();

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.includes("auth/callback")) return;
        try {
          const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
          const params = new URLSearchParams(query);
          const errorDescription = params.get("error_description");
          if (errorDescription) throw new Error(errorDescription);
          const code = params.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
        } catch (e) {
          console.error("[native-auth] sign-in return failed", e);
        } finally {
          await Browser.close().catch(() => {});
          window.location.assign("/app");
        }
      });
      remove = () => handle.remove();
    })();

    return () => remove();
  }, []);

  return null;
}
