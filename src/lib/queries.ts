import { db, Swimmer, Result, RankingSnapshot, Badge } from "./db";

export async function getPrimary(): Promise<Swimmer | null> {
  const { data } = await db().from("swim_swimmers").select("*").eq("is_primary", true).eq("active", true).limit(1).maybeSingle();
  return data as Swimmer | null;
}

export async function getSwimmers(): Promise<Swimmer[]> {
  const { data } = await db().from("swim_swimmers").select("*").eq("active", true).order("is_primary", { ascending: false }).order("last_name");
  return (data ?? []) as Swimmer[];
}

export async function getResults(swimmerId: string): Promise<Result[]> {
  const { data } = await db()
    .from("swim_results")
    .select("*")
    .eq("swimmer_id", swimmerId)
    .order("swim_date", { ascending: true });
  return (data ?? []) as Result[];
}

export async function getRecentResults(limit = 40): Promise<(Result & { swimmer: Swimmer })[]> {
  const { data } = await db()
    .from("swim_results")
    .select("*, swimmer:swim_swimmers(*)")
    .eq("is_split", false)
    .order("swim_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as (Result & { swimmer: Swimmer })[];
}

export async function getLatestSnapshots(): Promise<RankingSnapshot[]> {
  const { data: last } = await db()
    .from("swim_rankings_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return [];
  const { data } = await db().from("swim_rankings_snapshots").select("*").eq("snapshot_date", last.snapshot_date);
  return (data ?? []) as RankingSnapshot[];
}

export async function getPreviousSnapshots(beforeDate: string): Promise<RankingSnapshot[]> {
  const { data: prev } = await db()
    .from("swim_rankings_snapshots")
    .select("snapshot_date")
    .lt("snapshot_date", beforeDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return [];
  const { data } = await db().from("swim_rankings_snapshots").select("*").eq("snapshot_date", prev.snapshot_date);
  return (data ?? []) as RankingSnapshot[];
}

export async function getBadges(swimmerId: string): Promise<Badge[]> {
  const { data } = await db().from("swim_badges").select("*").eq("swimmer_id", swimmerId).order("earned_at");
  return (data ?? []) as Badge[];
}

export interface UpcomingEntry {
  disc: string;
  status: "accepted" | "reserve" | "entered";
  seed: number | null;
}

export interface Upcoming {
  csps_id: number;
  title: string;
  location: string | null;
  start_date: string;
  entries: Record<string, UpcomingEntry[]> | null;
  has_startlist: boolean;
}

export async function getUpcomingCompetitions(): Promise<Upcoming[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("swim_competitions")
    .select("csps_id,title,location,start_date,entries,has_startlist")
    .gte("start_date", today)
    .order("start_date")
    .limit(10);
  return (data ?? []) as Upcoming[];
}

// Personal bests per discipline for a given pool length, finals only
export function personalBests(results: Result[], pool: number = 25): Map<string, Result> {
  const pb = new Map<string, Result>();
  for (const r of results) {
    if (r.is_split || r.is_dsq || r.pool_length !== pool) continue;
    const cur = pb.get(r.discipline);
    if (!cur || r.time_ms < cur.time_ms) pb.set(r.discipline, r);
  }
  return pb;
}
