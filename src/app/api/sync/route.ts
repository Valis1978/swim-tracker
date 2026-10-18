import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runLiveSync, runSync } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// token in the "x-sync-token" header (the ?token= form still works, but URLs end up in access logs)
// mode=live → race-day polling (cheap, exits early when nobody races around today)
// backfill=<days> → also rebuild entry stories of meets swum in the last N days (max 120)
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-sync-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.SYNC_TOKEN;
  if (!expected || !token || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const mode = req.nextUrl.searchParams.get("mode");
  const backfillDays = Number(req.nextUrl.searchParams.get("backfill"));
  try {
    if (mode === "live") return NextResponse.json({ success: true, ...(await runLiveSync()) });
    const backfillFrom =
      Number.isInteger(backfillDays) && backfillDays > 0
        ? new Date(Date.now() - Math.min(backfillDays, 120) * 86400_000).toISOString().slice(0, 10)
        : undefined;
    return NextResponse.json({ success: true, ...(await runSync({ backfillFrom })) });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
