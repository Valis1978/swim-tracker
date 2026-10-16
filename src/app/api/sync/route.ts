import { NextRequest, NextResponse } from "next/server";
import { runLiveSync, runSync } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// mode=live → race-day polling (cheap, exits early when nobody races around today)
// backfill=<days> → also rebuild entry stories of meets swum in the last N days (max 120)
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-sync-token") ?? req.nextUrl.searchParams.get("token");
  if (!process.env.SYNC_TOKEN || token !== process.env.SYNC_TOKEN) {
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
