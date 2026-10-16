// Builds the replay of one swum entry: her time, the previous record as a ghost, and (when allowed) her heat and birth year.
import type { ReplayParams } from "./anim/replay";
import type { CapKey } from "./anim/look";
import type { Result } from "./db";
import { eventName } from "./present";
import type { CompetitionRow, EntryRow } from "./queries";
import { distanceOf } from "./strokes";
import { shortDate } from "./time";

export function replayParamsFor(
  e: EntryRow,
  comp: CompetitionRow,
  results: Result[],
  o: { nick: string; cap: CapKey; birthYear: number | null; showField: boolean }
): ReplayParams | undefined {
  if (e.status !== "swum" || e.result_ms == null) return undefined;
  const pool: 25 | 50 = comp.pool_length === 50 ? 50 : 25;
  const prev = results
    .filter((r) => r.discipline === e.discipline && r.pool_length === pool && !r.is_dsq && r.time_ms < 6_000_000 && r.swim_date < comp.start_date)
    .sort((a, b) => a.time_ms - b.time_ms)[0];
  return {
    title: eventName(e.discipline),
    distance: distanceOf(e.discipline),
    pool,
    me: e.result_ms,
    meLabel: `${o.nick} · ${shortDate(comp.start_date)}`,
    ghost: prev ? prev.time_ms : null,
    ghostLabel: prev ? `rekord ${shortDate(prev.swim_date)}` : null,
    lane: e.lane,
    cap: o.cap,
    heatNo: e.field?.heat ?? e.heat ?? null,
    heat: o.showField ? (e.field?.racers ?? null) : null,
    year: o.showField ? (e.field?.year ?? null) : null,
    yearNames: o.showField ? (e.field?.yearNames ?? null) : null,
    yearClubs: o.showField ? (e.field?.yearClubs ?? null) : null,
    yearMe: e.field?.yearMe ?? null,
    nick: o.nick,
    birthYear: o.birthYear,
  };
}

// Before the race: her heat from the start list, everyone swimming her entry time ("jak by to mohlo dopadnout").
export function previewParamsFor(e: EntryRow, comp: CompetitionRow, o: { nick: string; cap: CapKey; birthYear: number | null }): ReplayParams | undefined {
  if (e.status !== "drawn" || !e.field?.pre) return undefined;
  const me = e.field.racers.find((r) => r.me);
  if (!me || me.time <= 0 || e.field.racers.filter((r) => r.time > 0).length < 2) return undefined;
  return {
    title: eventName(e.discipline),
    distance: distanceOf(e.discipline),
    pool: comp.pool_length === 50 ? 50 : 25,
    me: me.time,
    meLabel: `${o.nick} · přihlášený čas`,
    ghost: null,
    ghostLabel: null,
    lane: e.lane,
    cap: o.cap,
    heatNo: e.field.heat,
    heat: e.field.racers,
    year: null,
    nick: o.nick,
    birthYear: o.birthYear,
    predicted: true,
  };
}
