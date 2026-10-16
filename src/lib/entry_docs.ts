// Parsers for meet documents that organisers publish on the CSPS portal:
// - Swim Meet Manager (swimsolutions.cz) "Přihlášky klubů (po odhláškách)" PDF — per-swimmer
//   rows "N) DIST STROKE  TIME  STATUS" where STATUS is heat/lane ("2/5"), reserve ("N3"),
//   accepted ("A") or not accepted ("X");
// - Swim Meet Manager "Startovní listina" PDF (single- or two-column layout with "Náhradníci");
// - OMEGA start-list CSV (heat 0 = reserve).
// Pure functions over already-extracted text, so they can be unit-tested without network or PDFs.

export interface PdfItem {
  s: string;
  x: number;
  y: number;
  w: number;
}

export interface PdfPage {
  width: number;
  height: number;
  items: PdfItem[];
}

export type DocStatus =
  | { kind: "drawn"; heat: number; lane: number; heatCount: number | null }
  | { kind: "reserve"; no: number | null }
  | { kind: "accepted" }
  | { kind: "not_accepted" };

export interface DocEntry {
  eventNo: number;
  disc: string; // normalised, e.g. "100K"
  seedMs: number | null;
  status: DocStatus;
}

export function normName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// "NOVÁKOVÁ", "Anna" -> "Anna Nováková" (results list surnames in capitals)
export function displayName(first: string, last: string): string {
  const l = last.trim();
  const nice = l && l === l.toLocaleUpperCase("cs") ? l.toLocaleLowerCase("cs").replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase("cs")) : l;
  return `${first.trim()} ${nice}`.trim();
}

// "Anna Nováková" -> "Anna N."
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? "";
}

export function personKey(fullName: string, year: number | null): string {
  return `${normName(fullName)}|${year ?? ""}`;
}

// "100 VZ" | "100VZ" | "100 K" -> "100K"; volný způsob (VZ) = K, polohový závod (PZ) = O
export function normDisc(code: string): string {
  const compact = code.toUpperCase().replace(/\s+/g, "");
  const m = compact.match(/^(\d+)([A-Z]+)$/);
  if (!m) return compact;
  const stroke: Record<string, string> = { VZ: "K", K: "K", PZ: "O", O: "O", P: "P", Z: "Z", M: "M" };
  return m[1] + (stroke[m[2]] ?? m[2]);
}

// "02:07,70" | "00:57,90" | "57,90" | "1:05.3" -> ms; "-" / "" -> null
export function parseSeed(t: string): number | null {
  const m = t.trim().match(/^(?:(\d{1,2}):)?(\d{1,2})[,.](\d{1,2})$/);
  if (!m) return null;
  const hundredths = m[3].length === 1 ? Number(m[3]) * 10 : Number(m[3]);
  const ms = ((Number(m[1] ?? 0) * 60 + Number(m[2])) * 100 + hundredths) * 10;
  return ms > 0 ? ms : null;
}

// Group text items into visual rows (PDF y grows upwards), tolerant to baseline jitter.
export function rows(items: PdfItem[], tol = 2.5): PdfItem[][] {
  const sorted = [...items].filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const out: { y: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else out.push({ y: it.y, items: [it] });
  }
  return out.map((r) => r.items.sort((a, b) => a.x - b.x));
}

const joinRow = (r: PdfItem[]) => r.map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim();

// ---- "Přihlášky klubů (po odhláškách)" ------------------------------------

const ACC_EVENT_RE =
  /(\d{1,3})\)\s*(\d{2,4})\s*(VZ|PZ|[PZKMO])\s+((?:\d{1,2}:)?\d{1,2},\d{2}|-)\s+(\d{1,2}\/\d{1,2}|N\s?\d{1,3}|[AX])$/;
const ACC_PERSON_RE = /^(.+?)\s+((?:19|20)\d{2})\s+\d{1,3}\)/;
const CLUB_HDR_RE = /^Přihlášky\s*-\s*(\S+)/;

function accStatus(token: string): DocStatus {
  const drawn = token.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (drawn) return { kind: "drawn", heat: Number(drawn[1]), lane: Number(drawn[2]), heatCount: null };
  const res = token.match(/^N\s?(\d{1,3})$/);
  if (res) return { kind: "reserve", no: Number(res[1]) };
  return token === "X" ? { kind: "not_accepted" } : { kind: "accepted" };
}

// Returns personKey -> entries. A swimmer missing from the map was not found in the document.
export function parseAcceptedList(pages: PdfPage[]): Map<string, DocEntry[]> {
  const out = new Map<string, DocEntry[]>();
  let club: string | null = null;
  let person: string | null = null;
  for (const page of pages) {
    for (const row of rows(page.items)) {
      const text = joinRow(row);
      const hdr = text.match(CLUB_HDR_RE);
      if (hdr) {
        // a club block can continue on the next page under a repeated header
        if (hdr[1] !== club) person = null;
        club = hdr[1];
        continue;
      }
      const ev = text.match(ACC_EVENT_RE);
      if (!ev) continue;
      const who = text.match(ACC_PERSON_RE);
      if (who) person = personKey(who[1], Number(who[2]));
      if (!person) continue;
      if (!out.has(person)) out.set(person, []);
      out.get(person)!.push({
        eventNo: Number(ev[1]),
        disc: normDisc(ev[2] + ev[3]),
        seedMs: parseSeed(ev[4]),
        status: accStatus(ev[5].replace(/\s/g, "")),
      });
    }
  }
  return out;
}

// ---- OMEGA start list CSV ---------------------------------------------------

export interface OmegaRow {
  eventNo: number;
  disc: string;
  key: string; // personKey
  name: string; // "Anna Nováková"
  year: number | null;
  club: string;
  seedMs: number | null;
  heat: number;
  lane: number;
}

export function parseOmegaCsv(text: string): OmegaRow[] {
  const out: OmegaRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.trim().split(";").map((x) => x.replaceAll('"', "").trim());
    if (p.length < 12 || !/^\d+$/.test(p[0])) continue;
    out.push({
      eventNo: Number(p[0]),
      disc: normDisc(p[1]),
      key: personKey(`${p[3]} ${p[4]}`, /^\d{4}$/.test(p[5]) ? Number(p[5]) : null),
      name: displayName(p[4], p[3]),
      year: /^\d{4}$/.test(p[5]) ? Number(p[5]) : null,
      club: p[7],
      seedMs: parseSeed(p[8]),
      heat: Number(p[10]) || 0,
      lane: Number(p[11]) || 0,
    });
  }
  return out;
}

// Her heat from the start list: who swims in which lane, with name, birth year, club and entry time.
export function heatLineup(rows: OmegaRow[], eventNo: number, heat: number, meKey: string): { lane: number; name: string; year: number; club: string; seedMs: number | null; me: boolean }[] {
  return rows
    .filter((r) => r.eventNo === eventNo && r.heat === heat && r.lane > 0)
    .map((r) => ({ lane: r.lane, name: r.name, year: r.year ?? 0, club: r.club, seedMs: r.seedMs, me: r.key === meKey }))
    .sort((a, b) => a.lane - b.lane);
}

// ---- "Startovní listina" PDF ------------------------------------------------

const EVENT_HDR_RE = /^(\d{1,3})\)\s+\d{2,4}\s+\S/; // "1) 200 Znak žačky"
const HEAT_HDR_RE = /(\d{1,2})\.\s*rozplavba\s+ze?\s+(\d{1,2})/i; // "1. rozplavba z 6" / "ze 3"
const RESERVE_HDR_RE = /^Náhradníci$/i;
const START_ROW_RE = /^(\d{1,2})\s+(.+?)\s+((?:19|20)\d{2})(?:\s|$)/; // "5 NAME First 2016 ..."

type Section = { y: number; kind: "heat"; heat: number; count: number } | { y: number; kind: "reserve" };

function columnSplit(page: PdfPage): number | null {
  const heads = page.items.filter((i) => i.s.trim() === "Jméno" || i.s.trim() === "Dr");
  const mid = page.width / 2;
  return heads.some((h) => h.x < mid * 0.9) && heads.some((h) => h.x > mid) ? mid : null;
}

// For the given swimmers, returns personKey -> eventNo -> status, as found in the start list.
export function parseStartListPdf(pages: PdfPage[], keys: Set<string>): Map<string, Map<number, DocStatus>> {
  const out = new Map<string, Map<number, DocStatus>>();
  let lastEvent: number | null = null;
  const lastSection: (Section | null)[] = [null, null];
  for (const page of pages) {
    const events = rows(page.items)
      .map((r) => ({ y: r[0].y, m: joinRow(r).match(EVENT_HDR_RE) }))
      .filter((e) => e.m)
      .map((e) => ({ y: e.y, no: Number(e.m![1]) }));
    const split = columnSplit(page);
    const columns = split == null ? [page.items] : [page.items.filter((i) => i.x < split), page.items.filter((i) => i.x >= split)];
    columns.forEach((colItems, c) => {
      const colRows = rows(colItems);
      const sections: Section[] = [];
      for (const r of colRows) {
        const t = joinRow(r);
        const h = t.match(HEAT_HDR_RE);
        if (h) sections.push({ y: r[0].y, kind: "heat", heat: Number(h[1]), count: Number(h[2]) });
        else if (RESERVE_HDR_RE.test(t)) sections.push({ y: r[0].y, kind: "reserve" });
      }
      for (const r of colRows) {
        const m = joinRow(r).match(START_ROW_RE);
        if (!m) continue;
        const key = personKey(m[2], Number(m[3]));
        if (!keys.has(key)) continue;
        const y = r[0].y;
        const above = sections.filter((s) => s.y > y).sort((a, b) => a.y - b.y)[0] ?? lastSection[c];
        const ev = events.filter((e) => e.y > y).sort((a, b) => a.y - b.y)[0]?.no ?? lastEvent;
        if (!above || ev == null) continue;
        const status: DocStatus =
          above.kind === "heat"
            ? { kind: "drawn", heat: above.heat, lane: Number(m[1]), heatCount: above.count }
            : { kind: "reserve", no: Number(m[1]) };
        if (!out.has(key)) out.set(key, new Map());
        out.get(key)!.set(ev, status);
      }
      if (sections.length) lastSection[c] = sections.reduce((a, b) => (b.y < a.y ? b : a));
    });
    if (events.length) lastEvent = events.reduce((a, b) => (b.y < a.y ? b : a)).no;
  }
  return out;
}
