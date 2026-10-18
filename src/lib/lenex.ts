// LENEX 3 results ("C_FILE_LENEX_RESULTS", a zipped .lxf exported by Swim Meet Manager). Organisers publish it
// on the CSPS portal right after the meet — days before CSPS imports the results into its own database.
// Pure functions (plus zlib), so they can be unit-tested without network.
import { inflateRawSync } from "node:zlib";
import { displayName } from "./entry_docs.ts"; // explicit extension: the unit tests run this file directly in Node

export interface LxResult {
  license: number | null; // CSPS user id
  name: string; // "Anna Nováková"
  birthYear: number | null;
  club: string; // club code
  eventNo: number; // event number = CSPS event identification
  date: string; // session date
  distance: number;
  stroke: string; // CSPS letter: K P Z M O
  ms: number | null; // null = no valid time
  status: string; // "" | "DSQ" | "DNS" | "DNF" | "WDR" | …
  points: number | null;
  heat: number | null;
  lane: number | null;
  splits: { distance: number; ms: number }[];
}

export interface Lenex {
  pool: 25 | 50 | null;
  city: string;
  results: LxResult[];
}

// first file of a zip archive (a plain .lef XML passes through)
export function unzipFirst(buf: Uint8Array): Uint8Array {
  if (buf[0] === 0x3c || (buf[0] === 0xef && buf[3] === 0x3c)) return buf; // "<" or BOM + "<"
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("LENEX: not a zip archive");
  const cd = dv.getUint32(eocd + 16, true);
  if (dv.getUint32(cd, true) !== 0x02014b50) throw new Error("LENEX: bad zip directory");
  const method = dv.getUint16(cd + 10, true);
  const size = dv.getUint32(cd + 20, true);
  const local = dv.getUint32(cd + 42, true);
  if (dv.getUint32(local, true) !== 0x04034b50) throw new Error("LENEX: bad zip entry");
  const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
  const data = buf.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`LENEX: zip method ${method}`);
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m)
  );

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = unescape(m[2]);
  return out;
}

// "00:02:02.16" -> 122160 ms; "NT" / "" -> null
export function lxTime(t: string | undefined): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const ms = ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]) * 10;
  return ms > 0 ? ms : null;
}

const STROKE: Record<string, string> = { FREE: "K", BACK: "Z", BREAST: "P", FLY: "M", MEDLEY: "O" };

export function parseLenex(xml: string): Lenex {
  const events = new Map<string, { no: number; date: string; distance: number; stroke: string; relay: boolean }>();
  const heats = new Map<string, number>();
  type Raw = Omit<LxResult, "eventNo" | "date" | "distance" | "stroke" | "heat"> & { eventId: string; heatId: string };
  const raw: Raw[] = [];
  let pool: 25 | 50 | null = null;
  let city = "";
  let date = "";
  let event: string | null = null;
  let club = "";
  let athlete: { license: number | null; name: string; birthYear: number | null } | null = null;
  let relay = 0;
  let cur: Raw | null = null;
  for (const m of xml.matchAll(/<(\/?)([A-Z]+)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, body, selfClose] = m;
    if (close) {
      if (tag === "ATHLETE") athlete = null;
      else if (tag === "RELAY") relay -= 1;
      else if (tag === "RESULT") cur = null;
      else if (tag === "EVENT") event = null;
      continue;
    }
    const a = attrs(body);
    switch (tag) {
      case "MEET":
        pool = a.course === "LCM" ? 50 : a.course === "SCM" ? 25 : null;
        city = a.city ?? "";
        break;
      case "SESSION":
        date = a.date ?? date;
        break;
      case "EVENT":
        if (a.eventid) {
          event = a.eventid;
          events.set(a.eventid, { no: Number(a.number), date, distance: 0, stroke: "", relay: false });
        }
        break;
      case "SWIMSTYLE":
        if (event && events.has(event)) {
          const ev = events.get(event)!;
          ev.distance = Number(a.distance) || 0;
          ev.stroke = STROKE[a.stroke ?? ""] ?? a.code ?? "";
          ev.relay = Number(a.relaycount ?? 1) > 1;
        }
        break;
      case "HEAT":
        if (a.heatid) heats.set(a.heatid, Number(a.number));
        break;
      case "CLUB":
        club = a.code ?? a.shortname ?? a.name ?? "";
        break;
      case "ATHLETE":
        athlete = {
          license: /^\d+$/.test(a.license ?? "") ? Number(a.license) : null,
          name: displayName(a.firstname ?? "", a.lastname ?? ""),
          birthYear: /^\d{4}/.test(a.birthdate ?? "") ? Number(a.birthdate!.slice(0, 4)) : null,
        };
        if (selfClose) athlete = null;
        break;
      case "RELAY":
        if (!selfClose) relay += 1;
        break;
      case "RESULT":
        if (athlete && !relay && a.eventid) {
          const ms = lxTime(a.swimtime);
          const status = (a.status ?? "").toUpperCase();
          cur = {
            ...athlete,
            club,
            eventId: a.eventid,
            heatId: a.heatid ?? "",
            ms: status ? null : ms,
            status,
            points: /^\d+$/.test(a.points ?? "") ? Number(a.points) : null,
            lane: /^\d+$/.test(a.lane ?? "") ? Number(a.lane) : null,
            splits: [],
          };
          raw.push(cur);
          if (selfClose) cur = null;
        }
        break;
      case "SPLIT": {
        const ms = lxTime(a.swimtime);
        if (cur && ms) cur.splits.push({ distance: Number(a.distance), ms });
        break;
      }
    }
  }
  const results: LxResult[] = [];
  for (const { eventId, heatId, ...r } of raw) {
    const ev = events.get(eventId);
    if (!ev || ev.relay || !ev.distance || !ev.stroke) continue;
    results.push({ ...r, eventNo: ev.no, date: ev.date, distance: ev.distance, stroke: ev.stroke, heat: heats.get(heatId) ?? null });
  }
  return { pool, city, results };
}

export function readLenex(buf: ArrayBuffer | Uint8Array): Lenex {
  return parseLenex(new TextDecoder("utf-8").decode(unzipFirst(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
}

// results of one event in the shape of CSPS category outputs (place by time, ties share it); no time = order 0
export function lenexOutputs(lx: Lenex, eventNo: number, dsqMs: number) {
  const rows = lx.results.filter((r) => r.eventNo === eventNo && r.status !== "DNS" && r.status !== "WDR");
  const times = rows.filter((r) => r.ms != null).map((r) => r.ms!);
  return rows.map((r) => ({
    userId: r.license ?? -1,
    time: r.ms ?? dsqMs,
    order: r.ms == null ? 0 : times.filter((t) => t < r.ms!).length + 1,
    birthYear: r.birthYear ?? 0,
    heat: r.heat,
    lane: r.lane,
    name: r.name,
    club: r.club,
  }));
}
