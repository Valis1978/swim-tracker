import { db, Swimmer } from "./db";
import * as csps from "./csps";
import { scrapeOpenWaterResults, distanceKey } from "./openwater_scrape";
import { fmtTime, fmtDelta, disciplineLabel } from "./format";
import { addDays, pragueToday } from "./time";
import { sendTelegram } from "./telegram";
import { loadLenex, scanEntries } from "./sync_entries";

const RANKING_DISCIPLINES = ["50 P", "100 P", "50 K", "50 Z", "100 Z"];

interface NewResultEvent {
  swimmer: Swimmer;
  discipline: string;
  pool: number;
  timeMs: number;
  date: string;
  location: string;
  isPB: boolean;
  prevPbMs: number | null;
  isDsq: boolean;
}

export async function runSync(opts: { backfillFrom?: string } = {}): Promise<{ newResults: number; swimmers: number; notes: string[] }> {
  const notes: string[] = [];
  const { data: swimmers, error } = await db().from("swim_swimmers").select("*").eq("active", true);
  if (error) throw error;

  const year = new Date().getFullYear();
  let titleMap: Map<number, { title: string; location: string }> | null = null;
  try {
    titleMap = await csps.getCompetitionTitleMap(year);
  } catch {
    notes.push("competitions list unavailable");
  }

  const events: NewResultEvent[] = [];
  let inserted = 0;
  for (const s of (swimmers ?? []) as Swimmer[]) {
    try {
      const r = await syncSwimmer(s, titleMap);
      events.push(...r.events);
      inserted += r.inserted;
    } catch (e) {
      notes.push(`sync ${s.last_name}: ${(e as Error).message}`);
    }
  }
  const lx = await syncLenexResults((swimmers ?? []) as Swimmer[], titleMap, notes);
  events.push(...lx.events);
  inserted += lx.inserted;

  await notifyResults(events);

  const primary = (swimmers ?? []).find((s: Swimmer) => s.is_primary) as Swimmer | undefined;
  if (primary?.birth_year) {
    try {
      await syncRankings(primary);
    } catch (e) {
      notes.push(`rankings: ${(e as Error).message}`);
    }
    await computeBadges(primary);
  }

  try {
    const en = await scanEntries({ backfillFrom: opts.backfillFrom });
    notes.push(...en.notes);
  } catch (e) {
    notes.push(`entries: ${(e as Error).message}`);
  }

  try {
    const ow = await scanOpenWater();
    notes.push(...ow.notes);
  } catch (e) {
    notes.push(`openwater: ${(e as Error).message}`);
  }

  try {
    const ows = await scrapeOwResults();
    notes.push(...ows.notes);
  } catch (e) {
    notes.push(`ow-scrape: ${(e as Error).message}`);
  }

  await db().from("swim_settings").upsert({ key: "last_sync", value: { at: new Date().toISOString(), newResults: inserted }, updated_at: new Date().toISOString() });
  return { newResults: inserted, swimmers: swimmers?.length ?? 0, notes };
}

async function notifyResults(events: NewResultEvent[]): Promise<void> {
  // notifications (skip per-swimmer initial backfill)
  for (const ev of events.filter((e) => !e.isDsq)) {
    const who = ev.swimmer.is_primary ? "🏊‍♀️ <b>Viki</b>" : `${ev.swimmer.first_name} ${ev.swimmer.last_name}`;
    const pb = ev.isPB
      ? ev.prevPbMs
        ? ` 🎉 <b>OSOBÁK</b> (${fmtDelta(ev.timeMs - ev.prevPbMs)})`
        : " — první start v disciplíně"
      : ev.prevPbMs
        ? ` (${fmtDelta(ev.timeMs - ev.prevPbMs)} od osobáku)`
        : "";
    await sendTelegram(`${who}: ${disciplineLabel(ev.discipline)} ${fmtTime(ev.timeMs)} (${ev.pool}m) · ${ev.location}${pb}`);
  }

}

// Race-day polling: refresh results + entries only for swimmers racing around today.
// Exits after one DB query when nobody races, so it is cheap to call every 15 minutes.
export async function runLiveSync(): Promise<{ skipped: boolean; newResults: number; notes: string[] }> {
  const today = pragueToday();
  const { data: racing } = await db()
    .from("swim_entries")
    .select("swimmer_id")
    .gte("swim_date", addDays(today, -1))
    .lte("swim_date", addDays(today, 1));
  const ids = [...new Set((racing ?? []).map((r) => r.swimmer_id as string))];
  if (!ids.length) return { skipped: true, newResults: 0, notes: [] };
  const notes: string[] = [];
  const { data: swimmers } = await db().from("swim_swimmers").select("*").in("id", ids).eq("active", true);
  let titleMap: Map<number, { title: string; location: string }> | null = null;
  try {
    titleMap = await csps.getCompetitionTitleMap(Number(today.slice(0, 4)));
  } catch {
    notes.push("competitions list unavailable");
  }
  const events: NewResultEvent[] = [];
  let inserted = 0;
  for (const s of (swimmers ?? []) as Swimmer[]) {
    try {
      const r = await syncSwimmer(s, titleMap);
      events.push(...r.events);
      inserted += r.inserted;
    } catch (e) {
      notes.push(`sync ${s.last_name}: ${(e as Error).message}`);
    }
  }
  const lx = await syncLenexResults((swimmers ?? []) as Swimmer[], titleMap, notes);
  events.push(...lx.events);
  inserted += lx.inserted;
  await notifyResults(events);
  const primary = ((swimmers ?? []) as Swimmer[]).find((s) => s.is_primary);
  if (primary && inserted) await computeBadges(primary);
  try {
    const en = await scanEntries({ live: true });
    notes.push(...en.notes);
  } catch (e) {
    notes.push(`entries: ${(e as Error).message}`);
  }
  return { skipped: false, newResults: inserted, notes };
}

async function syncSwimmer(s: Swimmer, titleMap: Map<number, { title: string; location: string }> | null): Promise<{ events: NewResultEvent[]; inserted: number }> {
  const outputs = await csps.getOutputs(s.csps_user_id);
  const disciplinePools = new Map<string, Set<number>>();
  for (const o of outputs) {
    if (!disciplinePools.has(o.disciplineCode)) disciplinePools.set(o.disciplineCode, new Set());
    disciplinePools.get(o.disciplineCode)!.add(o.poolLength);
  }

  // official rows of every discipline first, so rows taken from a LENEX file can be replaced meet by meet
  const official: { disc: string; pool: number; r: csps.CspsImprovementRow }[] = [];
  for (const [disc, pools] of disciplinePools) {
    for (const pool of pools) for (const r of await csps.getImprovements(s.csps_user_id, pool, disc)) official.push({ disc, pool, r });
  }
  const officialMeets = [...new Set(official.map((o) => o.r.competitionId).filter((c) => c != null))];
  const replaced = new Set<string>();
  if (officialMeets.length) {
    const { data: gone } = await db()
      .from("swim_results")
      .delete()
      .eq("swimmer_id", s.id)
      .eq("source", "lenex")
      .in("competition_csps_id", officialMeets)
      .select("discipline,pool_length,time_ms,swim_date,is_split");
    for (const r of gone ?? []) replaced.add(`${r.discipline}|${r.pool_length}|${r.swim_date}|${r.time_ms}|${r.is_split}`);
  }

  const { data: existing } = await db()
    .from("swim_results")
    .select("discipline,pool_length,time_ms,swim_date,is_split")
    .eq("swimmer_id", s.id);
  const known = new Set((existing ?? []).map((r) => `${r.discipline}|${r.pool_length}|${r.swim_date}|${r.time_ms}|${r.is_split}`));
  const isBackfill = known.size === 0 && replaced.size === 0;

  // map of best non-split 25m+50m PBs before this sync, per discipline|pool
  const pbBefore = new Map<string, number>();
  for (const r of existing ?? []) {
    if (r.is_split || r.time_ms >= csps.DSQ_THRESHOLD) continue;
    const k = `${r.discipline}|${r.pool_length}`;
    if (!pbBefore.has(k) || r.time_ms < pbBefore.get(k)!) pbBefore.set(k, r.time_ms);
  }

  const pointsByKey = new Map<string, number | null>();
  for (const o of outputs) pointsByKey.set(`${o.disciplineCode}|${o.poolLength}|${o.date.slice(0, 10)}|${o.time}`, o.points);

  const events: NewResultEvent[] = [];
  let inserted = 0;
  for (const { disc, pool, r } of official) {
    const date = r.date.slice(0, 10);
    const key = `${disc}|${pool}|${date}|${r.time}|${r.splitTime}`;
    if (known.has(key)) continue;
    const isDsq = r.time >= csps.DSQ_THRESHOLD;
    const comp = titleMap?.get(r.competitionId);
    const { error } = await db().from("swim_results").insert({
      swimmer_id: s.id,
      discipline: disc,
      pool_length: pool,
      time_ms: r.time,
      is_dsq: isDsq,
      is_split: r.splitTime,
      points: pointsByKey.get(`${disc}|${pool}|${date}|${r.time}`) ?? null,
      swim_date: date,
      competition_csps_id: r.competitionId,
      competition_title: comp?.title ?? null,
      location: r.location,
    });
    if (error && !error.message.includes("duplicate")) throw error;
    known.add(key);
    inserted += 1;
    if (r.splitTime || isDsq) continue;
    const k = `${disc}|${pool}`;
    const prev = pbBefore.get(k) ?? null;
    if (prev === null || r.time < prev) pbBefore.set(k, r.time);
    // a result taken from the organiser's file was announced already
    if (isBackfill || replaced.has(key)) continue;
    events.push({ swimmer: s, discipline: disc, pool, timeMs: r.time, date, location: r.location, isPB: prev === null || r.time < prev, prevPbMs: prev, isDsq });
  }
  return { events, inserted };
}

const DSQ_MS = csps.DSQ_THRESHOLD + 39_990; // how CSPS stores a disqualification
const SPLIT_DISTANCES = new Set([50, 100, 200, 400, 800]);

// Results of the last days from the organiser's LENEX file, for swimmers CSPS has no results for yet.
// Inserted with source "lenex"; syncSwimmer replaces them once CSPS imports the meet.
async function syncLenexResults(
  swimmers: Swimmer[],
  titleMap: Map<number, { title: string; location: string }> | null,
  notes: string[]
): Promise<{ events: NewResultEvent[]; inserted: number }> {
  const events: NewResultEvent[] = [];
  let inserted = 0;
  if (!swimmers.length) return { events, inserted };
  const today = pragueToday();
  const { data: ents } = await db()
    .from("swim_entries")
    .select("competition_csps_id,swimmer_id")
    .in("swimmer_id", swimmers.map((s) => s.id))
    .gte("swim_date", addDays(today, -10))
    .lte("swim_date", today);
  const byMeet = new Map<number, Set<string>>();
  for (const e of ents ?? []) {
    const cid = Number(e.competition_csps_id);
    if (!byMeet.has(cid)) byMeet.set(cid, new Set());
    byMeet.get(cid)!.add(e.swimmer_id as string);
  }
  for (const [cid, ids] of byMeet) {
    const { data: have } = await db().from("swim_results").select("swimmer_id").eq("competition_csps_id", cid).eq("source", "csps");
    const missing = swimmers.filter((s) => ids.has(s.id) && !(have ?? []).some((h) => h.swimmer_id === s.id));
    if (!missing.length) continue;
    let docs: csps.CspsCompetitionDocs;
    try {
      docs = await csps.getCompetitionDocs(cid);
    } catch (e) {
      notes.push(`lenex docs ${cid}: ${(e as Error).message}`);
      continue;
    }
    const lx = await loadLenex(cid, docs.documents, notes);
    if (!lx?.pool) continue;
    const comp = titleMap?.get(cid);
    for (const s of missing) {
      const mine = lx.results.filter((r) => r.license === s.csps_user_id && r.status !== "DNS" && r.status !== "WDR" && (r.ms != null || r.status === "DSQ"));
      if (!mine.length) continue;
      const { data: existing } = await db().from("swim_results").select("discipline,pool_length,time_ms,swim_date,is_split").eq("swimmer_id", s.id);
      const known = new Set((existing ?? []).map((r) => `${r.discipline}|${r.pool_length}|${r.swim_date}|${r.time_ms}|${r.is_split}`));
      const pbBefore = new Map<string, number>();
      for (const r of existing ?? []) {
        if (r.is_split || r.time_ms >= csps.DSQ_THRESHOLD) continue;
        const k = `${r.discipline}|${r.pool_length}`;
        if (!pbBefore.has(k) || r.time_ms < pbBefore.get(k)!) pbBefore.set(k, r.time_ms);
      }
      const rows = mine.flatMap((r) => [
        { discipline: `${r.distance} ${r.stroke}`, time_ms: r.ms ?? DSQ_MS, is_dsq: r.ms == null, is_split: false, points: r.points, swim_date: r.date },
        // splits at standard distances count like CSPS splits (not in medley: half a medley is not a medley)
        ...(r.stroke === "O"
          ? []
          : r.splits
              .filter((sp) => SPLIT_DISTANCES.has(sp.distance) && sp.distance < r.distance)
              .map((sp) => ({ discipline: `${sp.distance} ${r.stroke}`, time_ms: sp.ms, is_dsq: false, is_split: true, points: null, swim_date: r.date }))),
      ]);
      for (const row of rows) {
        const key = `${row.discipline}|${lx.pool}|${row.swim_date}|${row.time_ms}|${row.is_split}`;
        if (known.has(key)) continue;
        const { error } = await db().from("swim_results").insert({
          swimmer_id: s.id,
          ...row,
          pool_length: lx.pool,
          competition_csps_id: cid,
          competition_title: comp?.title ?? null,
          location: comp?.location ?? lx.city,
          source: "lenex",
        });
        if (error && !error.message.includes("duplicate")) {
          notes.push(`lenex ${cid}: ${error.message}`);
          continue;
        }
        known.add(key);
        inserted += 1;
        if (row.is_split || row.is_dsq) continue;
        const k = `${row.discipline}|${lx.pool}`;
        const prev = pbBefore.get(k) ?? null;
        events.push({ swimmer: s, discipline: row.discipline, pool: lx.pool, timeMs: row.time_ms, date: row.swim_date, location: comp?.location ?? lx.city, isPB: prev === null || row.time_ms < prev, prevPbMs: prev, isDsq: false });
        if (prev === null || row.time_ms < prev) pbBefore.set(k, row.time_ms);
      }
    }
  }
  return { events, inserted };
}

async function syncRankings(primary: Swimmer): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  for (const disc of RANKING_DISCIPLINES) {
    const rows = await csps.getRankings({
      gender: primary.gender,
      birthYear: primary.birth_year!,
      discipline: disc,
      poolLength: 25,
      startDate: csps.seasonStart(),
      endDate: today,
    });
    const clean = rows.filter((r) => r.time < csps.DSQ_THRESHOLD);
    const times = clean.map((r) => r.time);
    const idx = clean.findIndex((r) => r.userId === primary.csps_user_id);
    const q = (p: number) => (times.length ? times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))] : null);
    const { error } = await db().from("swim_rankings_snapshots").upsert(
      {
        snapshot_date: today,
        discipline: disc,
        pool_length: 25,
        birth_year: primary.birth_year,
        gender: primary.gender,
        total_swimmers: clean.length,
        best_time_ms: times[0] ?? null,
        median_time_ms: q(50),
        p10_time_ms: q(10),
        p90_time_ms: q(90),
        primary_rank: idx >= 0 ? idx + 1 : null,
        primary_time_ms: idx >= 0 ? clean[idx].time : null,
        entries: clean.map((r) => ({ u: r.userId, t: r.time })),
      },
      { onConflict: "snapshot_date,discipline,pool_length,birth_year,gender" }
    );
    if (error) throw error;
  }
}

const RACE_MILESTONES = [1, 5, 10, 20];
const BADGE_DEFS: { key: string; label: string; emoji: string; test: (ctx: BadgeCtx) => boolean }[] = [
  { key: "first_race", label: "První závod", emoji: "🌊", test: (c) => c.raceCount >= 1 },
  { key: "races_5", label: "5 závodů", emoji: "🐬", test: (c) => c.raceCount >= 5 },
  { key: "races_10", label: "10 závodů", emoji: "🦈", test: (c) => c.raceCount >= 10 },
  { key: "races_20", label: "20 závodů", emoji: "🐋", test: (c) => c.raceCount >= 20 },
  { key: "sub_60_50p", label: "50 prsa pod minutu", emoji: "⚡", test: (c) => (c.pb.get("50 P") ?? Infinity) < 60000 },
  { key: "sub_55_50p", label: "50 prsa pod 55 s", emoji: "🚀", test: (c) => (c.pb.get("50 P") ?? Infinity) < 55000 },
  { key: "sub_120_100p", label: "100 prsa pod 2 minuty", emoji: "💪", test: (c) => (c.pb.get("100 P") ?? Infinity) < 120000 },
  { key: "sub_45_50k", label: "50 kraul pod 45 s", emoji: "🌀", test: (c) => (c.pb.get("50 K") ?? Infinity) < 45000 },
  { key: "five_disciplines", label: "5 různých disciplín", emoji: "🌈", test: (c) => c.disciplines >= 5 },
  { key: "national_cup", label: "Pohár ČR", emoji: "🏆", test: (c) => c.nationalCup },
];

interface BadgeCtx { raceCount: number; pb: Map<string, number>; disciplines: number; nationalCup: boolean }

async function computeBadges(primary: Swimmer): Promise<void> {
  const { data: results } = await db()
    .from("swim_results")
    .select("discipline,pool_length,time_ms,swim_date,is_split,is_dsq,competition_title")
    .eq("swimmer_id", primary.id);
  const rows = (results ?? []).filter((r) => !r.is_split);
  const raceDays = new Set(rows.map((r) => r.swim_date));
  const pb = new Map<string, number>();
  for (const r of rows) {
    if (r.is_dsq || r.pool_length !== 25) continue;
    if (!pb.has(r.discipline) || r.time_ms < pb.get(r.discipline)!) pb.set(r.discipline, r.time_ms);
  }
  const ctx: BadgeCtx = {
    raceCount: raceDays.size,
    pb,
    disciplines: new Set(rows.filter((r) => !r.is_dsq).map((r) => r.discipline)).size,
    nationalCup: rows.some((r) => (r.competition_title ?? "").toLowerCase().includes("pohár čr")),
  };
  for (const def of BADGE_DEFS) {
    if (!def.test(ctx)) continue;
    await db().from("swim_badges").upsert(
      { swimmer_id: primary.id, badge_key: def.key, label: def.label, emoji: def.emoji },
      { onConflict: "swimmer_id,badge_key", ignoreDuplicates: true }
    );
  }
  void RACE_MILESTONES;
}

// ---- Open water (dálkové plavání) ----------------------------------------
// For each tracked swimmer, find their open-water races via applications (userId match),
// then resolve time + placing from the category outputs once results exist.

export async function scanOpenWater(): Promise<{ newResults: number; notes: string[] }> {
  const notes: string[] = [];
  const { data: swimmers } = await db().from("swim_swimmers").select("*").eq("active", true);
  const byUserId = new Map((swimmers ?? []).map((s: Swimmer) => [s.csps_user_id, s]));
  if (byUserId.size === 0) return { newResults: 0, notes };

  const from = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  let comps: csps.CspsCompetitionRow[] = [];
  try {
    comps = (await csps.getCompetitions(year)).filter(
      (c) => c.sport === 2 && !c.masters && c.startDate?.slice(0, 10) >= from && c.startDate?.slice(0, 10) <= to
    );
  } catch (e) {
    notes.push(`ow competitions: ${(e as Error).message}`);
    return { newResults: 0, notes };
  }

  const newResults = 0;
  for (const comp of comps) {
    let entries: csps.OwApplication[];
    try {
      entries = await csps.getOpenWaterEntries(comp.competitionId);
    } catch {
      continue;
    }
    const ours = entries.filter((e) => byUserId.has(e.userId));
    if (ours.length === 0) continue;

    // CSPS carries entries only — open-water RESULTS come from the plavani.info scraper.
    // Insert an entry if none exists; never clobber an existing row (especially a result).
    for (const e of ours) {
      const swimmer = byUserId.get(e.userId)!;
      await db().from("swim_ow_results").upsert(
        {
          swimmer_id: swimmer.id,
          competition_csps_id: comp.competitionId,
          competition_title: comp.title,
          location: comp.location,
          category_id: e.categoryId,
          distance_label: e.distanceLabel,
          distance_key: distanceKey(e.distanceLabel),
          gender: e.gender,
          status: e.overLimit ? "reserve" : "entered",
          swim_date: comp.startDate?.slice(0, 10) ?? null,
        },
        { onConflict: "swimmer_id,swim_date,distance_key", ignoreDuplicates: true }
      );
    }
  }
  return { newResults, notes };
}

// ---- Open-water RESULTS from plavani.info (PDF scrape) -------------------
// CSPS doesn't carry open-water results; plavani.info publishes them as PDFs.
// Merge scraped results into swim_ow_results by (swimmer, date, distance_key),
// upgrading existing 'entered' rows to 'result' and inserting plavani-only races.

export async function scrapeOwResults(): Promise<{ newResults: number; notes: string[] }> {
  const { data: swimmers } = await db().from("swim_swimmers").select("*").eq("active", true);
  const list = (swimmers ?? []) as Swimmer[];
  if (list.length === 0) return { newResults: 0, notes: [] };

  const { matches, notes } = await scrapeOpenWaterResults(
    list.map((s) => ({ id: s.id, last_name: s.last_name, birth_year: s.birth_year, club_abbrev: s.club_abbrev }))
  );

  let newResults = 0;
  const byId = new Map(list.map((s) => [s.id, s]));
  for (const m of matches) {
    const { data: existing } = await db()
      .from("swim_ow_results")
      .select("id, status")
      .eq("swimmer_id", m.swimmerId)
      .eq("swim_date", m.date)
      .eq("distance_key", m.distanceKey)
      .maybeSingle();

    if (existing?.status === "result") continue; // already have it

    if (existing) {
      await db().from("swim_ow_results").update({
        time_ms: m.finishMs, place_rank: m.placing, field_n: m.field,
        status: "result", source: "plavani", competition_title: m.title,
        location: m.title, distance_label: m.distanceLabel, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await db().from("swim_ow_results").insert({
        swimmer_id: m.swimmerId, competition_csps_id: null, category_id: null,
        competition_title: m.title, location: m.title, distance_label: m.distanceLabel,
        distance_key: m.distanceKey, time_ms: m.finishMs, place_rank: m.placing,
        field_n: m.field, status: "result", source: "plavani", swim_date: m.date,
      });
    }

    newResults += 1;
    const s = byId.get(m.swimmerId)!;
    const who = s.is_primary ? "🏊‍♀️ <b>Viki</b>" : `${s.first_name} ${s.last_name}`;
    await sendTelegram(`🌊 <b>Dálkové plavání</b> — ${m.title}\n${who}: ${m.distanceLabel} ${fmtTime(m.finishMs)} — ${m.placing}. z ${m.field}`);
    if (s.is_primary) {
      await db().from("swim_badges").upsert(
        { swimmer_id: s.id, badge_key: "open_water", label: "Dálkové plavání", emoji: "🌊" },
        { onConflict: "swimmer_id,badge_key", ignoreDuplicates: true }
      );
    }
  }
  return { newResults, notes };
}
