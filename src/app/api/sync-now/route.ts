import { NextResponse } from "next/server";
import { isParent } from "@/lib/auth";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Manual sync from the settings screen — authenticated by app PIN cookie
export async function POST() {
  if (!(await isParent())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
