import Link from "next/link";
import { signOut } from "@/server/scenes";

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[rgba(33,31,41,0.08)] bg-[var(--wc-paper)]">
        <Link href="/app" className="font-serif text-lg text-[var(--wc-ink)]">
          Writer&apos;s Cube
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/app" className="text-zinc-600 hover:text-zinc-900">
            Dashboard
          </Link>
          <Link href="/app/prompts" className="text-zinc-600 hover:text-zinc-900">
            Prompts
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-zinc-500 hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
