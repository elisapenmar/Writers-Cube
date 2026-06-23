import { NextResponse } from "next/server";
import { buildAccountBackup } from "@/server/backup";

export const maxDuration = 60;

/** Download the whole account as one portable JSON file. Always works — no Drive needed. */
export async function GET() {
  const bundle = await buildAccountBackup();
  const body = JSON.stringify(bundle, null, 2);
  const filename = `writers-cube-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
