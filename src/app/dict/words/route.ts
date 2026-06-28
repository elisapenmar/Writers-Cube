import { NextResponse } from "next/server";

// A broad (~275k) English word list used to supplement the Hunspell checker,
// which misses many valid derived forms (e.g. "pixelated", "pitter"). Served
// here (Node only) and merged into a Set on the client. Cached hard — static.
export const runtime = "nodejs";

export async function GET() {
  const mod = (await import("an-array-of-english-words")) as unknown as {
    default?: string[];
  };
  const words = (mod.default ?? (mod as unknown as string[])) as string[];
  return new NextResponse(words.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
