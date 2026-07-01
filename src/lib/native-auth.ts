"use client";

import { createClient } from "@/lib/supabase/client";
import { isNative } from "@/lib/platform";

export type OAuthProvider = "google" | "apple";

/**
 * Custom URL scheme the native shells register (see the iOS Info.plist
 * CFBundleURLTypes and the Android AndroidManifest intent-filter). Supabase
 * redirects here after OAuth; the deep link reopens the app and
 * `NativeAuthHandler` finishes the session.
 */
export const NATIVE_AUTH_REDIRECT = "com.writerscube.app://auth/callback";

/**
 * Start an OAuth sign-in.
 *
 * - **Web:** the normal Supabase redirect flow (navigates to the provider, comes
 *   back to `/auth/callback`, the server route exchanges the code). Unchanged.
 * - **Native (Capacitor):** Google blocks OAuth inside an app's embedded web
 *   view, so we run the handshake in the **system browser**. We ask Supabase for
 *   the provider URL without navigating (`skipBrowserRedirect`), open it with
 *   `@capacitor/browser`, and point `redirectTo` at our custom scheme so the OS
 *   deep-links back into the app (handled by `NativeAuthHandler`). The PKCE code
 *   verifier is stored in the web view here and read back there on exchange, so
 *   no server round-trip is needed on native.
 *
 * Capacitor is imported dynamically so it never enters the web/SSR bundle.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<{ error?: string }> {
  const supabase = createClient();

  if (!isNative()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: "Could not start sign-in." };

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url });
  return {};
}
