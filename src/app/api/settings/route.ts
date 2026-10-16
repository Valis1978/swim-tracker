import { NextRequest, NextResponse } from "next/server";
import { isParent } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Parent-only app settings. Currently: whether the kid view shows placings at races.
export async function POST(req: NextRequest) {
  if (!(await isParent())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body = (await req.json().catch(() => null)) as { kidShowPlaces?: unknown } | null;
  if (!body || typeof body.kidShowPlaces !== "boolean") {
    return NextResponse.json({ success: false, error: "Neplatné nastavení" }, { status: 400 });
  }
  const { error } = await db()
    .from("swim_settings")
    .upsert({ key: "kid_show_places", value: { on: body.kidShowPlaces }, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ success: false, error: "Nastavení se nepodařilo uložit" }, { status: 500 });
  return NextResponse.json({ success: true });
}
