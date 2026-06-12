import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isParent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Race days of one swimmer with all final results (for race-vs-race comparison)
export async function GET(req: NextRequest) {
  if (!(await isParent())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const swimmerId = req.nextUrl.searchParams.get("swimmerId");
  if (!swimmerId) return NextResponse.json({ success: false, error: "Chybí swimmerId" }, { status: 400 });

  const { data: results, error } = await db()
    .from("swim_results")
    .select("discipline,pool_length,time_ms,is_dsq,swim_date,competition_title,location")
    .eq("swimmer_id", swimmerId)
    .eq("is_split", false)
    .order("swim_date");
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const days = new Map<string, { date: string; title: string; pool: number; results: { disc: string; time: number; isDsq: boolean }[] }>();
  for (const r of results ?? []) {
    if (!days.has(r.swim_date)) {
      days.set(r.swim_date, {
        date: r.swim_date,
        title: r.competition_title ?? r.location ?? "",
        pool: r.pool_length,
        results: [],
      });
    }
    days.get(r.swim_date)!.results.push({ disc: r.discipline, time: r.time_ms, isDsq: r.is_dsq });
  }
  return NextResponse.json({ success: true, days: [...days.values()] });
}
