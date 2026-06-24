import { db, Swimmer } from "./db";
import * as csps from "./csps";
import { scrapeOpenWaterResults, distanceKey } from "./openwater_scrape";
import { fmtTime, fmtDelta, disciplineLabel } from "./format";
import { sendTelegram } from "./telegram";

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

export async function runSync(): Promise<{ newResults: number; swimmers: number; notes: string[] }> {
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
    await scanUpcoming();
  } catch (e) {
    notes.push(`upcoming: ${(e as Error).message}`);
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

async function syncSwimmer(s: Swimmer, titleMap: Map<number, { title: string; location: string }> | null): Promise<{ events: NewResultEvent[]; inserted: number }> {
  const outputs = await csps.getOutputs(s.csps_user_id);
  const disciplinePools = new Map<string, Set<number>>();
  for (const o of outputs) {
    if (!disciplinePools.has(o.disciplineCode)) disciplinePools.set(o.disciplineCode, new Set());
    disciplinePools.get(o.disciplineCode)!.add(o.poolLength);
  }

  const { data: existing } = await db()
    .from("swim_results")
    .select("discipline,pool_length,time_ms,swim_date,is_split")
    .eq("swimmer_id", s.id);
  const known = new Set((existing ?? []).map((r) => `${r.discipline}|${r.pool_length}|${r.swim_date}|${r.time_ms}|${r.is_split}`));
  const isBackfill = known.size === 0;

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
  for (const [disc, pools] of disciplinePools) {
    for (const pool of pools) {
      const rows = await csps.getImprovements(s.csps_user_id, pool, disc);
      for (const r of rows) {
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
        if (!isBackfill && !r.splitTime && !isDsq) {
          const k = `${disc}|${pool}`;
          const prev = pbBefore.get(k) ?? null;
          events.push({
            swimmer: s, discipline: disc, pool, timeMs: r.time, date,
            location: r.location, isPB: prev === null || r.time < prev, prevPbMs: prev, isDsq,
          });
          if (prev === null || r.time < prev) pbBefore.set(k, r.time);
        }
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

// ---- Upcoming starts detection -------------------------------------------
// Scans future competitions (next 21 days), matches applications by userId,
// refines accepted/reserve from the OMEGA start list when published.

export interface EntryInfo {
  disc: string;
  status: "accepted" | "reserve" | "entered";
  seed: number | null;
}

export async function scanUpcoming(): Promise<{ notified: number }> {
  const { data: swimmers } = await db().from("swim_swimmers").select("*").eq("active", true);
  const byUserId = new Map((swimmers ?? []).map((s: Swimmer) => [s.csps_user_id, s]));
  if (byUserId.size === 0) return { notified: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  let comps = (await csps.getCompetitions(year)).filter(
    (c) => c.sport === 1 && !c.masters && c.startDate?.slice(0, 10) >= today && c.startDate?.slice(0, 10) <= horizon
  );
  // year boundary: include early next-year races when horizon crosses Jan 1
  if (horizon.slice(0, 4) !== String(year)) {
    const next = (await csps.getCompetitions(year + 1)).filter(
      (c) => c.sport === 1 && !c.masters && c.startDate?.slice(0, 10) >= today && c.startDate?.slice(0, 10) <= horizon
    );
    comps = comps.concat(next);
  }

  let notified = 0;
  for (const comp of comps) {
    let entries: Map<number, EntryInfo[]>;
    try {
      const apps = await csps.getApplicationEntries(comp.competitionId);
      entries = new Map();
      for (const a of apps) {
        if (!byUserId.has(a.userId)) continue;
        if (!entries.has(a.userId)) entries.set(a.userId, []);
        entries.get(a.userId)!.push({ disc: a.disciplineCode, status: a.overLimit ? "reserve" : "entered", seed: a.qualificationTime });
      }
    } catch {
      continue; // applications not public for this competition
    }
    if (entries.size === 0) continue;

    // refine with start list when available (matched by name+birth year)
    let hasStartlist = false;
    try {
      const sl = await csps.getStartList(comp.competitionId);
      if (sl && sl.length > 0) {
        hasStartlist = true;
        for (const [uid, list] of entries) {
          const s = byUserId.get(uid)!;
          for (const e of list) {
            const row = sl.find(
              (r) =>
                r.discipline.replace(" ", "") === e.disc.replace(" ", "") &&
                r.lastName.localeCompare(s.last_name, "cs", { sensitivity: "base" }) === 0 &&
                r.birthYear === String(s.birth_year ?? "")
            );
            if (row) e.status = row.heat > 0 ? "accepted" : "reserve";
          }
        }
      }
    } catch {
      // start list parsing is best-effort
    }

    const entriesJson: Record<string, EntryInfo[]> = {};
    for (const [uid, list] of entries) entriesJson[String(uid)] = list;

    const { data: existing } = await db().from("swim_competitions").select("entries").eq("csps_id", comp.competitionId).maybeSingle();
    const isNew = !existing || !existing.entries;

    await db().from("swim_competitions").upsert(
      {
        csps_id: comp.competitionId,
        title: comp.title,
        location: comp.location,
        pool_length: comp.poolLength,
        start_date: comp.startDate?.slice(0, 10),
        end_date: comp.endDate?.slice(0, 10),
        entries: entriesJson,
        has_startlist: hasStartlist,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "csps_id" }
    );

    if (isNew) {
      const lines: string[] = [];
      for (const [uid, list] of entries) {
        const s = byUserId.get(uid)!;
        const who = s.is_primary ? "🏊‍♀️ <b>Viki</b>" : `${s.first_name} ${s.last_name}`;
        const discs = list.map((e) => `${disciplineLabel(e.disc)}${e.status === "reserve" ? " (pod čarou)" : ""}`).join(", ");
        lines.push(`${who}: ${discs}`);
      }
      const d = comp.startDate?.slice(0, 10).split("-").reverse().join(". ").replace(/^0/, "");
      await sendTelegram(`📋 <b>Na startovce</b> — ${comp.title}, ${d} ${comp.location}\n${lines.join("\n")}`);
      notified += 1;
    }
  }
  return { notified };
}

// ---- Open water (dálkové plavání) ----------------------------------------
// For each tracked swimmer, find their open-water races via applications (userId match),
// then resolve time + placing from the category outputs once results exist.

export async function scanOpenWater(): Promise<{ newResults: number; notes: string[] }> {
  const notes: string[] = [];
  const { data: swimmers } = await db().from("swim_swimmers").select("*").eq("active", true);
  const byUserId = new Map((swimmers ?? []).map((s: Swimmer) => [s.csps_user_id, s]));
  if (byUserId.size === 0) return { newResults: 0, notes };

  const today = new Date().toISOString().slice(0, 10);
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

  let newResults = 0;
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
