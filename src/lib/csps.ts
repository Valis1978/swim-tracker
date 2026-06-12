// Client for the public (undocumented) CSPS portal REST API.
// Be polite: low frequency, throttled, identified UA, cache everything in our DB.
const BASE = "https://vysledky.czechswimming.cz/cz.zma.csps.portal.rest/api/public";
const UA = "swim-tracker-family-app/1.0 (vlastimil.valenta@gmail.com)";

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
