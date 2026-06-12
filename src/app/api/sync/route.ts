import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-sync-token") ?? req.nextUrl.searchParams.get("token");
  if (!process.env.SYNC_TOKEN || token !== process.env.SYNC_TOKEN) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
