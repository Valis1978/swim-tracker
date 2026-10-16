// Picks the one animated "moment" worth celebrating on the home screen (or a race page).
// Each moment has a stable key so the client plays it only once per event.
import type { DiveParams, MedalParams, PbParams, ReserveParams } from "./anim/cartoon";
import type { Result } from "./db";
import { fmtDelta, fmtTime } from "./format";
import { eventName } from "./present";
import type { CompetitionRow, EntryRow } from "./queries";
import { distanceOf, strokeOf } from "./strokes";
import { addDays, daysBetween, minutesToClock } from "./time";

export type Moment =
  | { kind: "pb"; key: string; title: string; text: string; href?: string; params: PbParams }
  | { kind: "medal"; key: string; title: string; text: string; href?: string; params: MedalParams }
  | { kind: "reserve"; key: string; title: string; text: string; href?: string; params: ReserveParams }
  | { kind: "dive"; key: string; title: string; text: string; href?: string; params: DiveParams };

const STROKE_CAPS: Record<string, string> = { P: "PRSA", Z: "ZNAK", K: "KRAUL", M: "MOTÝLEK", O: "POLOHOVKA" };

const city = (c: CompetitionRow) => (c.location ?? c.title).split(",")[0].trim();

export interface MomentInput {
  nick: string;
  today: string; // Prague date
  results: Result[];
  pbIds: Map<string, "pb" | "first">;
  meets: { id: number; comp: CompetitionRow; list: EntryRow[] }[];
  birthYear: number | null;
  showPlaces: boolean;
}

export function personalBestMoment(i: MomentInput): Moment | null {
  const recent = i.results.filter((r) => !r.is_split && !r.is_dsq && i.pbIds.get(r.id) === "pb" && daysBetween(r.swim_date, i.today) <= 3);
  let best: { r: Result; gain: number } | null = null;
  for (const r of recent) {
    const prev = i.results
      .filter((x) => x.discipline === r.discipline && x.pool_length === r.pool_length && !x.is_dsq && x.time_ms < 6_000_000 && x.swim_date < r.swim_date)
      .reduce((m, x) => Math.min(m, x.time_ms), Infinity);
    const gain = prev - r.time_ms;
    if (Number.isFinite(gain) && (!best || gain > best.gain)) best = { r, gain };
  }
  if (!best) return null;
  const { r, gain } = best;
  const meet = i.meets.find((m) => m.id === r.competition_csps_id);
  return {
    kind: "pb",
    key: `pb:${r.id}`,
    title: "Nový osobák!",
    text: `${eventName(r.discipline)}${r.pool_length === 50 ? " (50m bazén)" : ""} za ${fmtTime(r.time_ms)}, o ${(gain / 1000).toFixed(2).replace(".", ",")} s rychleji než dřív.`,
    href: meet ? `/zavod/${meet.id}` : undefined,
    params: {
      label: `${distanceOf(r.discipline)} m ${STROKE_CAPS[strokeOf(r.discipline)]} · ${i.nick.toUpperCase()}`,
      time: fmtTime(r.time_ms),
      banner: `NOVÝ OSOBÁK · ${fmtDelta(-gain)}`,
    },
  };
}

export function medalMoment(i: MomentInput): Moment | null {
  if (!i.showPlaces) return null;
  for (const m of i.meets) {
    if (daysBetween(m.comp.end_date ?? m.comp.start_date, i.today) > 3 || m.comp.start_date > i.today) continue;
    const e = m.list.filter((x) => x.status === "swum" && x.place_year != null && x.place_year <= 3).sort((a, b) => (a.place_year ?? 9) - (b.place_year ?? 9))[0];
    if (!e) continue;
    const place = e.place_year as 1 | 2 | 3;
    return {
      kind: "medal",
      key: `medal:${e.id}`,
      title: place === 1 ? "Vyhrála jsi!" : `${place}. místo!`,
      text: `${eventName(e.discipline)} na závodě ${m.comp.title}: ${place}. místo v ročníku${i.birthYear ? ` ${i.birthYear}` : ""}.`,
      href: `/zavod/${m.id}`,
      params: { place, caption: `${place}. místo v ročníku${i.birthYear ? ` ${i.birthYear}` : ""}`, sub: eventName(e.discipline) },
    };
  }
  return null;
}

export function reserveMoment(i: MomentInput): Moment | null {
  const since = addDays(i.today, -7);
  for (const m of i.meets) {
    if ((m.comp.end_date ?? m.comp.start_date) < i.today) continue;
    for (const e of m.list) {
      const h = [...e.history].reverse().find((x) => x.from?.status === "reserve" && (x.to.status === "drawn" || x.to.status === "accepted") && x.at.slice(0, 10) >= since);
      if (!h || (e.status !== "drawn" && e.status !== "accepted")) continue;
      const drawn = e.status === "drawn" && e.heat != null && e.lane != null;
      return {
        kind: "reserve",
        key: `reserve:${e.id}:${h.at}`,
        title: "Postoupila jsi z náhradnic!",
        text: `${eventName(e.discipline)} na závodě ${m.comp.title}${drawn ? `: rozplavba ${e.heat}, dráha ${e.lane}` : ""}.`,
        href: `/zavod/${m.id}`,
        params: {
          small: `${eventName(e.discipline)} · ${city(m.comp)}`,
          front: h.from?.reserve_no ? `Náhradnice č. ${h.from.reserve_no}` : "Náhradnice",
          back: drawn ? `Rozplavba ${e.heat} · dráha ${e.lane}` : "Jdeš do závodu!",
          lane: drawn ? String(e.lane) : "",
        },
      };
    }
  }
  return null;
}

// race day morning or freshly published heats: dive from her block
export function diveMoment(i: MomentInput, onlyMeet?: number): Moment | null {
  const since = addDays(i.today, -7);
  for (const m of i.meets) {
    if (onlyMeet != null && m.id !== onlyMeet) continue;
    if ((m.comp.end_date ?? m.comp.start_date) < i.today) continue;
    const drawn = m.list.filter((e) => e.status === "drawn" && e.lane != null).sort((a, b) => a.event_no - b.event_no);
    if (!drawn.length) continue;
    const first = drawn[0];
    const raceDay = m.comp.start_date <= i.today;
    const fresh = drawn.some((e) => e.history.some((h) => h.to.status === "drawn" && h.at.slice(0, 10) >= since));
    if (!raceDay && !fresh) continue;
    const start = minutesToClock(first.start_min);
    return {
      kind: "dive",
      key: raceDay ? `day:${m.id}` : `drawn:${m.id}`,
      title: raceDay ? "Dnes závodíš!" : "Máš rozlosováno!",
      text: raceDay
        ? `${m.comp.title}: první start ${eventName(first.discipline)}, rozplavba ${first.heat}, dráha ${first.lane}${start ? `, start půldne v ${start}` : ""}.`
        : `${m.comp.title}: ${drawn.length === 1 ? "1 trať" : drawn.length < 5 ? `${drawn.length} tratě` : `${drawn.length} tratí`} s rozplavbou a drahou. První: ${eventName(first.discipline)}, dráha ${first.lane}.`,
      href: `/zavod/${m.id}`,
      params: { lane: String(first.lane), intro: raceDay ? "tee" : undefined },
    };
  }
  return null;
}

export function pickHomeMoment(i: MomentInput): Moment | null {
  return personalBestMoment(i) ?? medalMoment(i) ?? reserveMoment(i) ?? diveMoment(i);
}
