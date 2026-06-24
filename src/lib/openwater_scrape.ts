// Scraper for plavani.info — open-water (dálkové plavání) results live there as PDFs,
// NOT in the CSPS results system. We download recent result PDFs, parse them with
// pdfjs-dist (pure JS, no system binary), and match tracked swimmers by name+year+club
// (open-water PDFs carry no CSPS userId).

const LISTING = "https://www.plavani.info/vysledky/";
const UA = "swim-tracker/1.0 (vlastimil.valenta@gmail.com)";

const PLACE_NAMES: Record<string, string> = {
  Luzice: "Lužická míle",
  Sec: "Memoriál Kroufka (Seč)",
  Tovacov: "Tovačovský maratón",
  Spinka: "Na Špince přes Špinku",
  Racice: "Račice",
  Veseli: "Veselská hodinovka",
  Brno: "Brno",
  Opava: "Opava",
  Hradek: "Hrádek",
  Kolin: "Kolín",
  Pastviny: "Pastviny",
  Libochovice: "Libochovice",
  CBudejovice: "České Budějovice",
  DVltavice: "Dolní Vltavice",
  VMyto: "Vysoké Mýto",
  Praha: "Praha",
};

export function normName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function distanceKey(label: string): string {
  const num = (label.match(/\d+/) ?? ["?"])[0];
  const unit = /m[ií]le|nm/i.test(label) ? "nm" : /km/i.test(label) ? "km" : "";
  return num + unit;
}

// Friendly display label from a distance key: "1nm" -> "1 míle", "3km" -> "3 km".
export function distanceDisplay(key: string): string {
  const m = key.match(/^(\d+)(nm|km)$/);
  if (!m) return key;
  return m[2] === "nm" ? `${m[1]} míle` : `${m[1]} km`;
}

function timeToMs(t: string): number | null {
  const m = t.match(/(\d+):(\d{2}):(\d{2})\.(\d)/);
  if (!m) return null;
  return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4] * 100;
}

export interface PdfRef {
  url: string;
  date: string; // YYYY-MM-DD
  place: string;
  title: string;
}

export async function listResultPdfs(sinceDays = 60): Promise<PdfRef[]> {
  const res = await fetch(LISTING, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`plavani.info listing HTTP ${res.status}`);
  const html = await res.text();
  const cutoff = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const out: PdfRef[] = [];
  const re = /https:\/\/www\.plavani\.info\/download\/vysledky\/Vysledky_(\d{4})(\d{2})(\d{2})_([A-Za-z]+)(?:_\w+)?\.pdf/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    const place = m[4];
    const url = m[0];
    if (date < cutoff || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, date, place, title: PLACE_NAMES[place] ?? place });
  }
  return out;
}

export async function pdfToLines(buf: ArrayBuffer): Promise<string[]> {
  // legacy build runs in Node without a worker
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const line = rows.get(y)!.sort((a, b) => a.x - b.x).map((o) => o.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

interface ResultRow { place: number; line: string; finishMs: number; category: string; field: number }

function parseRows(lines: string[]): ResultRow[] {
  let category: string | null = null;
  const blocks = new Map<string, { place: number; line: string; finishMs: number }[]>();
  for (const line of lines) {
    const isData = /^\d+\s+\d+\s+\S/.test(line) && /\d+:\d{2}:\d{2}\.\d/.test(line);
    if (!isData) {
      // category title line (e.g. "1 NM ml. Žačky"), not the column header
      if (!/Jm[eé]no|Po\s*ř|RokN|Klub/i.test(line) && line.length < 45 && /(NM|km|Žačky|žačky|žáci|Žáci|muži|ženy|Muži|Ženy|kadet|junior|dorost)/i.test(line)) {
        category = line.replace(/\s+/g, " ").trim();
      }
      continue;
    }
    const cat = category ?? "?";
    if (!blocks.has(cat)) blocks.set(cat, []);
    const place = parseInt(line.match(/^(\d+)/)![1]);
    const times = [...line.matchAll(/\d+:\d{2}:\d{2}\.\d/g)].map((mm) => mm[0]);
    const finishMs = timeToMs(times[times.length - 1]);
    if (finishMs != null) blocks.get(cat)!.push({ place, line, finishMs });
  }
  const out: ResultRow[] = [];
  for (const [cat, rows] of blocks) for (const r of rows) out.push({ ...r, category: cat, field: rows.length });
  return out;
}

export interface OwScrapeMatch {
  swimmerId: string;
  date: string;
  title: string;
  place: string; // place name
  category: string;
  distanceLabel: string;
  distanceKey: string;
  placing: number;
  field: number;
  finishMs: number;
}

export interface ScrapeSwimmer {
  id: string;
  last_name: string;
  birth_year: number | null;
  club_abbrev: string | null;
}

export async function scrapeOpenWaterResults(swimmers: ScrapeSwimmer[], sinceDays = 60): Promise<{ matches: OwScrapeMatch[]; notes: string[] }> {
  const notes: string[] = [];
  const matches: OwScrapeMatch[] = [];
  let pdfs: PdfRef[];
  try {
    pdfs = await listResultPdfs(sinceDays);
  } catch (e) {
    return { matches, notes: [`ow-scrape listing: ${(e as Error).message}`] };
  }

  for (const ref of pdfs) {
    let rows: ResultRow[];
    try {
      const res = await fetch(ref.url, { headers: { "User-Agent": UA }, redirect: "follow", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rows = parseRows(await pdfToLines(await res.arrayBuffer()));
    } catch (e) {
      notes.push(`ow-scrape ${ref.place} ${ref.date}: ${(e as Error).message}`);
      continue;
    }
    for (const sw of swimmers) {
      const nlast = normName(sw.last_name);
      const yr = sw.birth_year ? String(sw.birth_year) : null;
      const club = sw.club_abbrev;
      // a swimmer can appear in several distances in one PDF (e.g. 1 km AND 3 km) — take them all
      const hits = rows.filter(
        (r) => normName(r.line).includes(nlast) && (!yr || r.line.includes(yr)) && (!club || new RegExp(club, "i").test(r.line))
      );
      const seenKeys = new Set<string>();
      for (const hit of hits) {
        const dkey = distanceKey(hit.category);
        if (seenKeys.has(dkey)) continue;
        seenKeys.add(dkey);
        matches.push({
          swimmerId: sw.id,
          date: ref.date,
          title: ref.title,
          place: ref.place,
          category: hit.category,
          distanceLabel: distanceDisplay(dkey),
          distanceKey: dkey,
          placing: hit.place,
          field: hit.field,
          finishMs: hit.finishMs,
        });
      }
    }
  }
  return { matches, notes };
}
