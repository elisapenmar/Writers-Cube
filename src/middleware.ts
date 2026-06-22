import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every request (except static assets). Refreshes the Supabase session
 * and gates access: unauthenticated visitors to /app are redirected to /login,
 * and signed-in users hitting /login are sent on to /app. The redirect logic
 * lives in updateSession() in @/lib/supabase/middleware.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico and common static image files
     * Everything else (including /app and /login) is gated.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
