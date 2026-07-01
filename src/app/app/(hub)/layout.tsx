import Link from "next/link";
import { CubeMark } from "@/components/cube-mark";
import { AccountMenu } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/server/feedback";

// Allow AI server actions invoked from these pages up to 60s on Vercel.
export const maxDuration = 60;

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = await isAdmin();

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-[var(--wc-border)] bg-[var(--wc-surface)]">
        <Link href="/app" className="flex min-w-0 items-center gap-2 font-serif text-lg text-[var(--wc-ink)]">
          <CubeMark size={20} />
          <span className="truncate">Writer&apos;s Cube</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-4 text-sm">
          {/* Text links are desktop niceties; on phones they made the fixed-width
              nav overflow (pushing the account menu off-screen and widening the
              whole page). The logo already navigates to the dashboard, so hide
              them below sm and keep just the logo + account menu on mobile. */}
          <Link href="/app" className="hidden sm:inline text-[var(--wc-muted)] hover:text-[var(--wc-ink)]">
            Dashboard
          </Link>
          {admin && (
            <Link href="/app/admin/feedback" className="hidden sm:inline text-[var(--wc-muted)] hover:text-[var(--wc-ink)]">
              Feedback
            </Link>
          )}
          <AccountMenu email={user?.email ?? null} />
        </nav>
      </header>
      {/* Clip stray horizontal overflow so hub pages never force a zoom-out /
          sideways scroll on phones (a dashboard should only scroll vertically). */}
      <div className="flex flex-1 flex-col overflow-x-clip">{children}</div>
    </div>
  );
}
