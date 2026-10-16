// Personal records per pool length, including official split times (CSPS lists them as bests).
import type { Result } from "./db";
import { distanceOf, STROKE_ORDER, strokeOf, type StrokeKey } from "./strokes";

const DSQ = 6_000_000;

export interface RecordRow {
  discipline: string;
  distance: number;
  stroke: StrokeKey;
  best: Result;
  fromSplit: boolean;
  starts: number; // races swum (splits excluded)
  firstMs: number | null;
  gainMs: number | null; // first race -> record
  series: number[]; // best-so-far after each race day: never gets worse
  lastSwum: string;
}

export function computeRecords(results: Result[], pool: number): RecordRow[] {
  const byDisc = new Map<string, Result[]>();
  for (const r of results) {
    if (r.pool_length !== pool || r.is_dsq || r.time_ms >= DSQ) continue;
    if (!byDisc.has(r.discipline)) byDisc.set(r.discipline, []);
    byDisc.get(r.discipline)!.push(r);
  }
  const out: RecordRow[] = [];
  for (const [disc, rows] of byDisc) {
    rows.sort((a, b) => a.swim_date.localeCompare(b.swim_date) || a.time_ms - b.time_ms);
    const best = rows.reduce((m, r) => (r.time_ms < m.time_ms ? r : m));
    const finals = rows.filter((r) => !r.is_split);
    const first = finals[0] ?? rows[0];
    const days = new Map<string, number>();
    for (const r of rows) days.set(r.swim_date, Math.min(days.get(r.swim_date) ?? Infinity, r.time_ms));
    let run = Infinity;
    const series = [...days.values()].map((t) => (run = Math.min(run, t)));
    const gain = first.time_ms - best.time_ms;
    out.push({
      discipline: disc,
      distance: distanceOf(disc),
      stroke: strokeOf(disc),
      best,
      fromSplit: best.is_split,
      starts: new Set(finals.map((r) => `${r.swim_date}|${r.competition_csps_id}`)).size,
      firstMs: first.time_ms,
      gainMs: gain > 0 ? gain : null,
      series,
      lastSwum: rows[rows.length - 1].swim_date,
    });
  }
  return out.sort((a, b) => STROKE_ORDER.indexOf(a.stroke) - STROKE_ORDER.indexOf(b.stroke) || a.distance - b.distance);
}

// For each race result: was it a personal best at that moment, or the very first swim?
export function pbFlags(results: Result[]): Map<string, "pb" | "first"> {
  const flags = new Map<string, "pb" | "first">();
  for (const r of results) {
    if (r.is_split || r.is_dsq || r.time_ms >= DSQ) continue;
    const earlier = results.filter(
      (x) => x.discipline === r.discipline && x.pool_length === r.pool_length && !x.is_dsq && x.time_ms < DSQ && x.swim_date < r.swim_date
    );
    if (!earlier.length) flags.set(r.id, "first");
    else if (r.time_ms < Math.min(...earlier.map((x) => x.time_ms))) flags.set(r.id, "pb");
  }
  return flags;
}
