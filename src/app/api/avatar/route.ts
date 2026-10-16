import { NextRequest, NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCapKey } from "@/lib/anim/look";

export const dynamic = "force-dynamic";

// Viki picks the cap of her cartoon swimmer — the one setting the kid role may change.
export async function POST(req: NextRequest) {
  if (!(await getRole())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body = (await req.json().catch(() => null)) as { cap?: unknown } | null;
  if (!body || !isCapKey(body.cap)) {
    return NextResponse.json({ success: false, error: "Neplatná čepice" }, { status: 400 });
  }
  const { error } = await db()
    .from("swim_settings")
    .upsert({ key: "avatar", value: { cap: body.cap }, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ success: false, error: "Čepici se nepodařilo uložit" }, { status: 500 });
  return NextResponse.json({ success: true });
}
