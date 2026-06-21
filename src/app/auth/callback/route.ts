import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  // The Drive connect flow tags its callback so we know to store the Google tokens.
  const isDrive = searchParams.get("drive") === "1";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const session = data.session;
      if (isDrive && session?.provider_token && session.user) {
        // Persist the Google access/refresh tokens for server-side Drive calls.
        const expiresAt = new Date(Date.now() + 3500 * 1000).toISOString();
        await supabase.from("google_credentials").upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token ?? null,
          expires_at: expiresAt,
          email: session.user.email ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
