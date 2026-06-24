import Link from "next/link";
import { SquareArrow } from "@/components/icons";
import { listInspirations, type Inspiration } from "@/server/inspirations";
import { Inspirations } from "@/components/inspirations";

async function safeInspirations(): Promise<Inspiration[]> {
  try {
    return await listInspirations();
  } catch {
    return [];
  }
}

export default async function InspirationsPage() {
  const items = await safeInspirations();

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link href="/app" className="text-xs text-[var(--wc-faint)] hover:underline">
            <SquareArrow dir="left" className="inline-block align-[-3px] mr-1" /> Dashboard
          </Link>
          <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">
            All inspiration
          </h1>
        </div>

        <Inspirations initial={items} />
      </div>
    </div>
  );
}
