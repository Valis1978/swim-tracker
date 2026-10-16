import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cached: string | null = null;

// The build the server runs (public, carries nothing else) — lets a long-open app notice a new version.
export async function GET() {
  try {
    cached ??= readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    return NextResponse.json({ success: true, build: cached }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Build unknown" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
