import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isParent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Time series (25m finals) for all active swimmers in one discipline
export async function GET(req: NextRequest) {
  if (!(await isParent())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const discipline = req.nextUrl.searchParams.get("discipline") ?? "50 P";
  const { data: swimmers } = await db()
    .from("swim_swimmers")
    .select("id, first_name, last_name, is_primary")
    .eq("active", true);
  const { data: results } = await db()
    .from("swim_results")
    .select("swimmer_id, time_ms, swim_date, location")
    .eq("discipline", discipline)
    .eq("pool_length", 25)
    .eq("is_split", false)
    .eq("is_dsq", false)
    .order("swim_date");

  const bySwimmer = new Map<string, { date: string; time: number; location: string }[]>();
  for (const r of results ?? []) {
    if (!bySwimmer.has(r.swimmer_id)) bySwimmer.set(r.swimmer_id, []);
    bySwimmer.get(r.swimmer_id)!.push({ date: r.swim_date, time: r.time_ms, location: r.location ?? "" });
  }
  const out = (swimmers ?? [])
    .map((s) => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      isPrimary: s.is_primary,
      series: bySwimmer.get(s.id) ?? [],
    }))
    .filter((s) => s.series.length > 0)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "cs"));
  return NextResponse.json({ success: true, discipline, swimmers: out });
}
