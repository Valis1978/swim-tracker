// Client for the public (undocumented) CSPS portal REST API.
// Be polite: low frequency, throttled, identified UA, cache everything in our DB.
const BASE = "https://vysledky.czechswimming.cz/cz.zma.csps.portal.rest/api/public";
const UA = "swim-tracker/1.0 (vlastimil.valenta@gmail.com)";

const THROTTLE_MS = 350;
let lastCall = 0;

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const wait = lastCall + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CSPS ${path} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const DSQ_THRESHOLD = 6_000_000; // times >= this are DSQ/NT markers
export const DISCIPLINES = ["50 P", "100 P", "200 P", "50 K", "100 K", "200 K", "50 Z", "100 Z", "50 M", "100 M", "100 O", "200 O"] as const;

export interface CspsProfile {
  userId: number;
  firstName: string;
  lastName: string;
  sex: "FEMALE" | "MALE";
  userProfileClubMemberDto?: { clubName: string; clubRegion: string } | null;
}

export interface CspsOutput {
  time: number;
  disciplineCode: string;
  poolLength: number;
  points: number | null;
  date: string;
  competitionId: number;
  competitionLocation: string;
  splitTime: boolean;
}

export interface CspsImprovementRow {
  date: string;
  time: number;
  competitionId: number;
  location: string;
  improvement: boolean;
  splitTime: boolean;
}

export interface CspsStatisticEntry {
  userId: number;
  firstName: string;
  lastName: string;
  birthYear: number;
  clubAbbrev: string;
  time: number;
  points: number | null;
  date: string;
  location: string;
}

export async function getProfile(userId: number): Promise<CspsProfile> {
  return get(`/user-profiles/${userId}`);
}

// PB per discipline+pool — cheap way to discover which disciplines a swimmer races
export async function getOutputs(userId: number): Promise<CspsOutput[]> {
  return get(`/user-profiles/${userId}/outputs`, { page: 1, perPage: 100 });
}

export async function getImprovements(userId: number, poolLength: number, discipline: string): Promise<CspsImprovementRow[]> {
  const d = await get<{ rows: CspsImprovementRow[] }>(`/user-profiles/${userId}/improvements`, {
    poolLength,
    disciplineAbbrev: discipline,
    improvementsOnly: "false",
    page: 1,
    limit: 100,
  });
  return d.rows ?? [];
}

export async function getCompetitionTitleMap(year: number): Promise<Map<number, { title: string; location: string }>> {
  const rows = await get<{ competitionId: number; title: string; location: string }[]>("/competitions", { year });
  return new Map(rows.map((r) => [r.competitionId, { title: r.title, location: r.location }]));
}

export async function getRankings(opts: {
  gender: "FEMALE" | "MALE";
  birthYear: number;
  discipline: string;
  poolLength: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}): Promise<CspsStatisticEntry[]> {
  const rows: CspsStatisticEntry[] = [];
  let page = 1;
  for (;;) {
    const d = await get<{ numberOfResults: number; publicStatisticDtos: CspsStatisticEntry[] }>("/statistics", {
      gender: opts.gender,
      birthYearFrom: opts.birthYear,
      birthYearTo: opts.birthYear,
      disciplineAbbrev: opts.discipline,
      poolLength: opts.poolLength,
      startDate: opts.startDate,
      endDate: opts.endDate,
      onlyBestResults: "true",
      statisticAgeGroupId: 1,
      page,
      perPage: 100,
    });
    rows.push(...(d.publicStatisticDtos ?? []));
    if (rows.length >= d.numberOfResults || !d.publicStatisticDtos?.length) break;
    page += 1;
  }
  return rows;
}

export function seasonStart(today = new Date()): string {
  const y = today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}-09-01`;
}

export interface CspsCompetitionRow {
  competitionId: number;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  poolLength: number;
  sport: number;
  masters: boolean;
  hasResults: boolean;
}

export async function getCompetitions(year: number): Promise<CspsCompetitionRow[]> {
  return get("/competitions", { year });
}

export interface CspsApplicationEntry {
  userId: number;
  disciplineCode: string;
  disciplineTitle: string;
  overLimit: boolean;
  qualificationTime: number | null;
  date: string;
}

// All individual entries of a competition (pre-race applications, exact userId match)
export async function getApplicationEntries(competitionId: number): Promise<CspsApplicationEntry[]> {
  const d = await get<{
    halfDays: { date: string; competitionCategories: { disciplineCode: string; disciplineTitle: string; applications: { userId: number; overLimit: boolean; qualificationTime: number | null }[] }[] }[];
  }>(`/competitions/${competitionId}/applications`);
  const out: CspsApplicationEntry[] = [];
  for (const h of d.halfDays ?? []) {
    for (const c of h.competitionCategories ?? []) {
      for (const a of c.applications ?? []) {
        out.push({
          userId: a.userId,
          disciplineCode: c.disciplineCode,
          disciplineTitle: c.disciplineTitle,
          overLimit: a.overLimit,
          qualificationTime: a.qualificationTime,
          date: h.date,
        });
      }
    }
  }
  return out;
}

export interface StartListRow {
  discipline: string;
  lastName: string;
  firstName: string;
  birthYear: string;
  club: string;
  heat: number;
  lane: number;
}

// OMEGA start list (after withdrawals): heat > 0 = seeded/accepted, heat 0 = reserve
export async function getStartList(competitionId: number): Promise<StartListRow[] | null> {
  const docs = await get<{ documents: { type: string; fileName: string }[] }>(`/competitions/${competitionId}/documents`);
  const sl = (docs.documents ?? []).find((x) => x.type === "START_LIST_CSV");
  if (!sl) return null;
  const url = `${BASE}/competitions/${competitionId}/documents/${encodeURIComponent(sl.type)}?fileName=${encodeURIComponent(sl.fileName)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const text = new TextDecoder("windows-1250").decode(await res.arrayBuffer());
  const rows: StartListRow[] = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(";");
    if (parts.length < 13 || !/^\d+$/.test(parts[0])) continue;
    rows.push({
      discipline: parts[1].replaceAll('"', ""),
      lastName: parts[3].replaceAll('"', ""),
      firstName: parts[4].replaceAll('"', ""),
      birthYear: parts[5].replaceAll('"', ""),
      club: parts[7].replaceAll('"', ""),
      heat: parseInt(parts[10]) || 0,
      lane: parseInt(parts[11]) || 0,
    });
  }
  return rows;
}
