import Link from "next/link";
import { CubeMark } from "@/components/cube-mark";
import { AccountMenu } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--wc-border)] bg-[var(--wc-surface)]">
        <Link href="/app" className="flex items-center gap-2 font-serif text-lg text-[var(--wc-ink)]">
          <CubeMark size={20} />
          Writer&apos;s Cube
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/app" className="text-[var(--wc-muted)] hover:text-[var(--wc-ink)]">
            Dashboard
          </Link>
          <Link href="/app/prompts" className="text-[var(--wc-muted)] hover:text-[var(--wc-ink)]">
            Prompts
          </Link>
          <AccountMenu email={user?.email ?? null} />
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
