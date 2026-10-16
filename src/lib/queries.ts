import { db, Swimmer, Result, RankingSnapshot, Badge } from "./db";
import type { EntrySnapshot, HistoryItem } from "./entries";
import type { PublicDoc } from "./sync_entries";
import type { CspsHalfDay } from "./csps";
import { niceTitle } from "./present";
import { DEFAULT_CAP, isCapKey, type Look } from "./anim/look";

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

export interface OwResult {
  id: string;
  swimmer_id: string;
  competition_title: string | null;
  location: string | null;
  distance_label: string;
  time_ms: number | null;
  place_rank: number | null;
  field_n: number | null;
  status: "entered" | "reserve" | "result";
  swim_date: string | null;
}

export async function getOpenWaterResults(swimmerId: string): Promise<OwResult[]> {
  const { data } = await db()
    .from("swim_ow_results")
    .select("*")
    .eq("swimmer_id", swimmerId)
    .order("swim_date", { ascending: false });
  return (data ?? []) as OwResult[];
}

export interface OwResultWithSwimmer extends OwResult {
  swimmer: Swimmer;
}

export async function getAllOpenWater(): Promise<OwResultWithSwimmer[]> {
  const { data } = await db()
    .from("swim_ow_results")
    .select("*, swimmer:swim_swimmers(*)")
    .order("swim_date", { ascending: false });
  return ((data ?? []) as OwResultWithSwimmer[]).filter((r) => r.swimmer && r.swimmer.active);
}

// ---- race entries -----------------------------------------------------------------


export interface EntryRow extends EntrySnapshot {
  id: string;
  swimmer_id: string;
  competition_csps_id: number;
  event_no: number;
  discipline: string;
  discipline_title: string | null;
  category_text: string | null;
  half_day: number | null;
  swim_date: string | null;
  warmup_min: number | null;
  start_min: number | null;
  seed_ms: number | null;
  seed_location: string | null;
  seed_date: string | null;
  result_points: number | null;
  place_overall: number | null;
  field_overall: number | null;
  place_year: number | null;
  field_year: number | null;
  source: string | null;
  history: HistoryItem[];
}

export interface CompetitionRow {
  csps_id: number;
  title: string;
  location: string | null;
  pool_length: number | null;
  start_date: string;
  end_date: string | null;
  registration_end: string | null;
  deregistration_end: string | null;
  state: string | null;
  halfdays: CspsHalfDay[] | null;
  documents: PublicDoc[] | null;
  has_startlist: boolean;
  has_accepted: boolean;
  has_results: boolean;
}

const COMP_COLS =
  "csps_id,title,location,pool_length,start_date,end_date,registration_end,deregistration_end,state,halfdays,documents,has_startlist,has_accepted,has_results";

export async function getSwimmerEntries(swimmerId: string): Promise<EntryRow[]> {
  const { data } = await db()
    .from("swim_entries")
    .select("*")
    .eq("swimmer_id", swimmerId)
    .order("swim_date", { ascending: false })
    .order("event_no");
  return (data ?? []) as EntryRow[];
}

export async function getCompetitionsByIds(ids: number[]): Promise<Map<number, CompetitionRow>> {
  if (!ids.length) return new Map();
  const { data } = await db().from("swim_competitions").select(COMP_COLS).in("csps_id", ids);
  return new Map(((data ?? []) as CompetitionRow[]).map((c) => [Number(c.csps_id), { ...c, title: niceTitle(c.title, c.location) }]));
}

export async function getCompetition(id: number): Promise<CompetitionRow | null> {
  const { data } = await db().from("swim_competitions").select(COMP_COLS).eq("csps_id", id).maybeSingle();
  const c = (data as CompetitionRow | null) ?? null;
  return c ? { ...c, title: niceTitle(c.title, c.location) } : null;
}

export async function getCompetitionEntries(id: number): Promise<(EntryRow & { swimmer: Swimmer })[]> {
  const { data } = await db()
    .from("swim_entries")
    .select("*, swimmer:swim_swimmers(*)")
    .eq("competition_csps_id", id)
    .order("event_no");
  return ((data ?? []) as (EntryRow & { swimmer: Swimmer })[]).filter((e) => e.swimmer?.active);
}

export async function getResultsAt(competitionId: number, swimmerId: string): Promise<Result[]> {
  const { data } = await db()
    .from("swim_results")
    .select("*")
    .eq("competition_csps_id", competitionId)
    .eq("swimmer_id", swimmerId);
  return (data ?? []) as Result[];
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from("swim_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

// Parent decides whether the kid view shows placings at races.
export async function kidSeesPlaces(): Promise<boolean> {
  const v = await getSetting<{ on?: boolean }>("kid_show_places", { on: true });
  return v.on !== false;
}

// Viki's cartoon look (the cap she picked); club cap by default.
export async function getLook(): Promise<Look> {
  const v = await getSetting<{ cap?: unknown }>("avatar", {});
  return { cap: isCapKey(v.cap) ? v.cap : DEFAULT_CAP };
}
