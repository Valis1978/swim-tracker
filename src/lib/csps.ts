// Client for the public (undocumented) CSPS portal REST API.
// Be polite: low frequency, throttled, identified UA, cache everything in our DB.
import { displayName } from "./entry_docs";

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

// ---- Entries with program structure (half-days, event numbers, seeds) ---------

export interface CspsHalfDay {
  order: number;
  date: string; // YYYY-MM-DD
  warmupMin: number | null; // minutes after midnight
  startMin: number | null;
}

export interface CspsEntryRow {
  userId: number;
  eventNo: number; // number in the meet program ("identification")
  categoryId: number;
  disciplineCode: string; // "100 Z"
  disciplineTitle: string; // "100m Znak"
  categoryText: string | null; // "Ženy 2012 - 2017"
  halfDay: number;
  date: string;
  overLimit: boolean;
  seedMs: number | null;
  seedLocation: string | null;
  seedDate: string | null;
}

export async function getCompetitionEntries(competitionId: number): Promise<{ halfDays: CspsHalfDay[]; entries: CspsEntryRow[] }> {
  const d = await get<{
    halfDays: {
      order: number;
      date: string;
      startTime1: number | null;
      startTime2: number | null;
      competitionCategories: {
        identification: number | null;
        competitionCategoryId: number;
        order: number;
        disciplineCode: string;
        disciplineTitle: string;
        categoryText: string | null;
        applications: { userId: number; overLimit: boolean; qualificationTime: number | null; qualificationLocation: string | null; qualificationDate: string | null }[];
      }[];
    }[];
  }>(`/competitions/${competitionId}/applications`);
  const halfDays: CspsHalfDay[] = [];
  const entries: CspsEntryRow[] = [];
  for (const h of d.halfDays ?? []) {
    const date = h.date.slice(0, 10);
    halfDays.push({ order: h.order, date, warmupMin: h.startTime1 ?? null, startMin: h.startTime2 ?? null });
    for (const c of h.competitionCategories ?? []) {
      for (const a of c.applications ?? []) {
        entries.push({
          userId: a.userId,
          eventNo: c.identification ?? c.order,
          categoryId: c.competitionCategoryId,
          disciplineCode: c.disciplineCode,
          disciplineTitle: c.disciplineTitle,
          categoryText: c.categoryText,
          halfDay: h.order,
          date,
          overLimit: a.overLimit,
          seedMs: a.qualificationTime && a.qualificationTime < DSQ_THRESHOLD ? a.qualificationTime : null,
          seedLocation: a.qualificationLocation ?? null,
          seedDate: a.qualificationDate?.slice(0, 10) ?? null,
        });
      }
    }
  }
  return { halfDays: halfDays.sort((a, b) => a.order - b.order), entries };
}

export interface CspsDocument {
  type: string;
  fileName: string;
}

export interface CspsCompetitionDocs {
  competitionId: number;
  title: string;
  competitionState: string | null;
  registrationEndDate: string | null; // local Prague time
  deregistrationEndDate: string | null;
  documents: CspsDocument[];
}

export async function getCompetitionDocs(competitionId: number): Promise<CspsCompetitionDocs> {
  const d = await get<CspsCompetitionDocs>(`/competitions/${competitionId}/documents`);
  return { ...d, documents: d.documents ?? [] };
}

export function documentUrl(competitionId: number, doc: CspsDocument): string {
  return `${BASE}/competitions/${competitionId}/documents/${encodeURIComponent(doc.type)}?fileName=${encodeURIComponent(doc.fileName)}`;
}

export async function downloadDocument(competitionId: number, doc: CspsDocument): Promise<ArrayBuffer | null> {
  const wait = lastCall + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(documentUrl(competitionId, doc), { headers: { "User-Agent": UA }, cache: "no-store" });
  return res.ok ? res.arrayBuffer() : null;
}

// ---- Open water (dálkové plavání, sport 2) -------------------------------
// Separate model: distance categories, no stroke code / pool length, placing by `order`.

export interface OwApplication {
  userId: number;
  categoryId: number;
  distanceLabel: string;
  gender: string;
  overLimit: boolean;
  date: string;
}

export async function getOpenWaterEntries(competitionId: number): Promise<OwApplication[]> {
  const d = await get<{
    halfDays: {
      date: string;
      competitionCategories: {
        competitionCategoryId: number;
        disciplineTitle: string;
        gender: string;
        applications: { userId: number; overLimit: boolean }[];
      }[];
    }[];
  }>(`/competitions/${competitionId}/applications`);
  const out: OwApplication[] = [];
  for (const h of d.halfDays ?? []) {
    for (const c of h.competitionCategories ?? []) {
      for (const a of c.applications ?? []) {
        out.push({
          userId: a.userId,
          categoryId: c.competitionCategoryId,
          distanceLabel: c.disciplineTitle,
          gender: c.gender,
          overLimit: a.overLimit,
          date: h.date,
        });
      }
    }
  }
  return out;
}

export interface OwOutput {
  userId: number;
  time: number;
  order: number;
  birthYear: number;
  heat: number | null; // "group" in CSPS results
  lane: number | null; // "line"
  name: string; // "Anna Nováková" (public results)
  club: string; // club abbreviation
}

export async function getCategoryOutputs(categoryId: number): Promise<OwOutput[]> {
  const d = await get<{
    singleOutputs: (Omit<OwOutput, "heat" | "lane" | "name" | "club"> & {
      group?: string | number | null;
      line?: string | number | null;
      firstName?: string | null;
      lastName?: string | null;
      clubAbbrev?: string | null;
    })[];
  }>(
    `/competitions/categories/${categoryId}/outputs`
  );
  const num = (v: string | number | null | undefined) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  return (d.singleOutputs ?? []).map((o) => ({
    userId: o.userId,
    time: o.time,
    order: o.order,
    birthYear: o.birthYear,
    heat: num(o.group),
    lane: num(o.line),
    name: displayName(o.firstName ?? "", o.lastName ?? ""),
    club: o.clubAbbrev ?? "",
  }));
}
