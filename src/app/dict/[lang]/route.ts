import { NextResponse } from "next/server";

// The Hunspell dictionary is read from disk by `dictionary-en` (Node only), so
// we serve it from this route and build the spell-checker on the client. Cached
// hard since the dictionary is effectively immutable.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (lang !== "en") {
    return NextResponse.json({ error: "unsupported language" }, { status: 404 });
  }

  const dict = (await import("dictionary-en")).default as {
    aff: Uint8Array;
    dic: Uint8Array;
  };
  const decoder = new TextDecoder("utf-8");
  return NextResponse.json(
    { aff: decoder.decode(dict.aff), dic: decoder.decode(dict.dic) },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
