// Server-side helpers for turning an image `src` (a data: URI or an http(s) URL)
// into raw bytes, plus a tiny dimension reader for PNG/JPEG/GIF used by the DOCX
// exporter. Pure functions — safe to import in route handlers / server actions.

export type ImageBytes = { bytes: Buffer; mime: string; ext: string };

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function extForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "png";
}

export function decodeDataUri(src: string): ImageBytes | null {
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(src);
  if (!m) return null;
  const mime = m[1] || "image/png";
  const isB64 = !!m[2];
  const data = m[3];
  const bytes = isB64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf-8");
  return { bytes, mime, ext: extForMime(mime) };
}

/** Resolve an image src to bytes — data URI inline, or fetched over http(s). */
export async function fetchImageBytes(src: string): Promise<ImageBytes | null> {
  try {
    if (src.startsWith("data:")) return decodeDataUri(src);
    if (!/^https?:\/\//i.test(src)) return null;
    const res = await fetch(src);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
    const bytes = Buffer.from(await res.arrayBuffer());
    return { bytes, mime, ext: extForMime(mime) };
  } catch {
    return null;
  }
}

/** Read intrinsic pixel dimensions from a PNG/JPEG/GIF buffer (best-effort). */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG: scan SOFn markers
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0..SOF15 (excluding DHT/DAC/RST/SOI/EOI/SOS)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return null;
}
