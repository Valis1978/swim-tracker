// Presentation helpers shared by pages: names, summaries and placings in kid-friendly Czech.
import { statusLabel, type Tone } from "./entries";
import { disciplineLabel } from "./format";
import type { EntryRow } from "./queries";
import { minutesToClock } from "./time";

const STROKE_WORD: Record<string, string> = { P: "prsa", Z: "znak", K: "kraul", VZ: "kraul", M: "motýlek", O: "polohovka", PZ: "polohovka" };

// "100 Z" -> "100 m znak", "200 PZ" -> "200 m polohovka"
export function eventName(code: string): string {
  const m = code.trim().match(/^(\d+)\s*([A-Z]+)$/i);
  const word = m ? STROKE_WORD[m[2].toUpperCase()] : undefined;
  return m && word ? `${m[1]} m ${word}` : disciplineLabel(code);
}

// "ZNOJEMSKÝ HROZEN" -> "Znojemský hrozen"; "NIGHT GRAND PRIX ZNOJMO" (Znojmo) -> "Night grand prix Znojmo".
// Only for titles typed in capitals; short acronyms (ČR, MČR, VC) and mixed-case titles stay as they are.
export function niceTitle(t: string, location?: string | null): string {
  const letters = [...t].filter((ch) => /\p{L}/u.test(ch));
  const upper = letters.filter((ch) => /\p{Lu}/u.test(ch)).length;
  if (!letters.length || upper / letters.length < 0.6) return t;
  const place = (location ?? "").toLocaleLowerCase("cs");
  const out = t
    .split(/(\s+)/)
    .map((w) => {
      if (!/^\p{Lu}{4,}[.,:]?$/u.test(w)) return w;
      const low = w.toLocaleLowerCase("cs");
      return place && place.includes(low.replace(/[.,:]$/, "")) ? low.charAt(0).toLocaleUpperCase("cs") + low.slice(1) : low;
    })
    .join("");
  return out.charAt(0).toLocaleUpperCase("cs") + out.slice(1);
}

export function halfDayName(order: number | null, startMin: number | null): string {
  if (startMin != null) return startMin < 12 * 60 ? "Dopoledne" : "Odpoledne";
  return order ? `${order}. půlden` : "Program";
}

export function halfDayTimes(warmupMin: number | null, startMin: number | null): string {
  const w = minutesToClock(warmupMin);
  const s = minutesToClock(startMin);
  return [w && `rozplavání ${w}`, s && `start ${s}`].filter(Boolean).join(" · ");
}

export function toneOf(e: EntryRow): Tone {
  return statusLabel(e).tone;
}

// "6 tratí · všechny potvrzené" / "4 potvrzené · 2 náhradnice" / "odplaváno 3 z 6"
export function meetSummary(entries: EntryRow[]): string {
  const n = entries.length;
  const count = (f: (e: EntryRow) => boolean) => entries.filter(f).length;
  const swum = count((e) => e.status === "swum" || e.status === "dsq");
  if (swum) return `odplaváno ${swum} ${n === swum ? (swum === 1 ? "trať" : swum < 5 ? "tratě" : "tratí") : `z ${n}`}`;
  const drawn = count((e) => e.status === "drawn");
  const ok = count((e) => e.status === "accepted") + drawn;
  const reserve = count((e) => e.status === "reserve");
  const out = count((e) => e.status === "not_accepted" || e.status === "withdrawn");
  const waiting = count((e) => e.status === "entered");
  const tr = (k: number) => (k === 1 ? "trať" : k < 5 ? "tratě" : "tratí");
  if (ok === n) return `${n} ${tr(n)} · ${drawn === n ? "všechny rozlosované" : "všechny potvrzené"}`;
  if (waiting === n) return `${n} ${tr(n)} · čeká se na potvrzení`;
  const parts = [
    ok && `${ok} ${ok === 1 ? "potvrzená" : ok < 5 ? "potvrzené" : "potvrzených"}`,
    reserve && `${reserve} ${reserve === 1 ? "náhradnice" : "náhradnice"}`,
    waiting && `${waiting} ${waiting === 1 ? "čeká" : "čekají"}`,
    out && `${out} ${out === 1 ? "nepoplave" : "nepoplave"}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export interface PlaceView {
  main: string; // "3. v ročníku 2016"
  of: string | null; // "z 9"
  overall: string | null; // "celkově 25. z 60" (parent only)
  medal: 1 | 2 | 3 | null;
}

export function placeView(e: EntryRow, birthYear: number | null, opts: { parent: boolean; kidPlaces: boolean }): PlaceView | null {
  if (e.status !== "swum") return null;
  if (!opts.parent && !opts.kidPlaces) return null;
  const overall = opts.parent && e.place_overall ? `celkově ${e.place_overall}. z ${e.field_overall}` : null;
  if (!e.place_year) return overall ? { main: overall, of: null, overall: null, medal: null } : null;
  return {
    main: `${e.place_year}. v ročníku${birthYear ? ` ${birthYear}` : ""}`,
    of: e.field_year ? `z ${e.field_year}` : null,
    overall,
    medal: e.place_year <= 3 ? (e.place_year as 1 | 2 | 3) : null,
  };
}

// Kid-safe hint for an entry that ended up out of the race.
export function outHint(e: EntryRow): string {
  if (e.status === "withdrawn") return "tuhle trať nepoplave";
  const wasReserve = e.reserve_no ?? e.history.find((h) => h.to.status === "reserve")?.to.reserve_no ?? null;
  if (wasReserve) return `byla jsi ${wasReserve}. náhradnice — tentokrát se místo neuvolnilo`;
  if (e.history.some((h) => h.to.status === "reserve")) return "byla jsi náhradnice — tentokrát se místo neuvolnilo";
  return "pořadatel musel omezit počet startů";
}
