// Race entries engine: for every tracked swimmer and every upcoming (or just-swum) meet,
// resolve each race to a status — entered / reserve (with order) / accepted / drawn (heat+lane) /
// not accepted / withdrawn / swum / dsq — from CSPS applications, the organiser's documents
// (accepted list after withdrawals, start list PDF, OMEGA CSV) and the results we already synced.
// Every change is appended to the entry's history, so the app can tell the story
// ("náhradnice č. 1 → postoupila: rozplavba 8, dráha 2").

import { db, Swimmer } from "./db";
import * as csps from "./csps";
import { disciplineLabel, fmtTime } from "./format";
import { sendTelegram } from "./telegram";
import { pdfPages } from "./pdf";
import {
  heatLineup,
  normDisc,
  parseAcceptedList,
  parseOmegaCsv,
  parseStartListPdf,
  personKey,
  type DocEntry,
  type DocStatus,
  type OmegaRow,
} from "./entry_docs";
import {
  changeText,
  changed,
  resolveStatus,
  snapshot,
  statusLabel,
  type DocVerdict,
  type EntrySnapshot,
  type HistoryItem,
  type RaceField,
  type StatusInputs,
} from "./entries";
import { addDays, pragueNow, pragueToday } from "./time";
import { lenexOutputs, readLenex, type Lenex } from "./lenex";

// Documents worth showing in the app (organiser PDFs); technical exports stay hidden.
const DOC_LABELS: Record<string, string> = {
  COMPETITION_PLAN: "Propozice",
  START_LIST_PDF: "Startovní listina",
  C_FILE_ACCEPTED: "Přijatí po odhláškách",
  RESULTS_PDF: "Výsledky",
  C_FILE_INFO1: "Informace",
  C_FILE_INFO2: "Informace",
};
const DOC_HIDDEN = /^(APPLICATION_AFTER_REGISTRATION_END|START_LIST_CSV|C_FILE_ACCEPTED_SUMS|C_FILE_LENEX.*|C_RESULTS_DATA|C_FILE_RESULTS_CSV|C_FILE_INFO_FOR_REFEREE)$/;

export interface PublicDoc {
  type: string;
  label: string;
  url: string;
}

function publicDocs(competitionId: number, docs: csps.CspsDocument[]): PublicDoc[] {
  return docs
    .filter((d) => !DOC_HIDDEN.test(d.type) && /\.(pdf|xlsx?)$/i.test(d.fileName))
    .filter((d) => DOC_LABELS[d.type] || /[a-zá-ž]/.test(d.type)) // custom types are human-written labels
    .map((d) => ({ type: d.type, label: DOC_LABELS[d.type] ?? d.type, url: csps.documentUrl(competitionId, d) }));
}

interface DocBundle {
  accepted: { map: Map<string, DocEntry[]>; date: string | null } | null;
  omega: OmegaRow[] | null;
  startPdf: { map: Map<string, Map<number, DocStatus>>; date: string | null } | null;
  lenex: Lenex | null;
}

const NO_DOCS: DocBundle = { accepted: null, omega: null, startPdf: null, lenex: null };

// The organiser's LENEX results, parsed once per run (results import and placings both use it).
const lenexCache = new Map<string, Promise<Lenex | null>>();
export function loadLenex(cid: number, docs: csps.CspsDocument[], notes: string[]): Promise<Lenex | null> {
  const doc = docs.find((d) => d.type === "C_FILE_LENEX_RESULTS");
  if (!doc) return Promise.resolve(null);
  const k = `${cid}|${doc.fileName}`;
  if (!lenexCache.has(k)) {
    lenexCache.set(
      k,
      csps
        .downloadDocument(cid, doc)
        .then((buf) => (buf ? readLenex(buf) : null))
        .catch((e: Error) => {
          notes.push(`lenex ${cid}: ${e.message}`);
          lenexCache.delete(k);
          return null;
        })
    );
    setTimeout(() => lenexCache.delete(k), 10 * 60_000).unref?.();
  }
  return lenexCache.get(k)!;
}

async function loadDocs(cid: number, docs: csps.CspsDocument[], keys: Set<string>, notes: string[]): Promise<DocBundle> {
  const out: DocBundle = { accepted: null, omega: null, startPdf: null, lenex: await loadLenex(cid, docs, notes) };
  const find = (type: string) => docs.find((d) => d.type === type);
  const omegaDoc = find("START_LIST_CSV");
  if (omegaDoc) {
    try {
      const buf = await csps.downloadDocument(cid, omegaDoc);
      if (buf) out.omega = parseOmegaCsv(new TextDecoder("windows-1250").decode(buf));
    } catch (e) {
      notes.push(`omega ${cid}: ${(e as Error).message}`);
    }
  }
  const acc = find("C_FILE_ACCEPTED");
  if (acc) {
    try {
      const buf = await csps.downloadDocument(cid, acc);
      if (buf) {
        const { pages, date } = await pdfPages(buf);
        out.accepted = { map: parseAcceptedList(pages), date };
      }
    } catch (e) {
      notes.push(`accepted ${cid}: ${(e as Error).message}`);
    }
  }
  const sl = find("START_LIST_PDF");
  if (sl && !out.omega?.length) {
    try {
      const buf = await csps.downloadDocument(cid, sl);
      if (buf) {
        const { pages, date } = await pdfPages(buf);
        out.startPdf = { map: parseStartListPdf(pages, keys), date };
      }
    } catch (e) {
      notes.push(`startlist ${cid}: ${(e as Error).message}`);
    }
  }
  return out;
}

function omegaVerdict(rows: OmegaRow[] | null, key: string, eventNo: number, disc: string): DocVerdict {
  if (!rows?.length) return { kind: "unknown" };
  const mine = rows.filter((r) => r.key === key);
  if (!mine.length) return { kind: "unknown" };
  const r = mine.find((x) => x.eventNo === eventNo && x.disc === disc) ?? mine.find((x) => x.disc === disc && !eventNo);
  if (!r) return { kind: "absent" };
  if (r.heat <= 0) return { kind: "reserve", no: null };
  const heatCount = Math.max(...rows.filter((x) => x.eventNo === r.eventNo).map((x) => x.heat));
  return { kind: "drawn", heat: r.heat, lane: r.lane, heatCount: heatCount > 0 ? heatCount : null };
}

function acceptedVerdict(b: DocBundle, key: string, eventNo: number, disc: string): DocVerdict & { date?: string | null } {
  const list = b.accepted?.map.get(key);
  if (!b.accepted || !list) return { kind: "unknown" };
  const e = list.find((x) => x.eventNo === eventNo && x.disc === disc) ?? list.find((x) => x.disc === disc && !eventNo);
  return { ...(e ? e.status : { kind: "absent" as const }), date: b.accepted.date };
}

function startPdfVerdict(b: DocBundle, key: string, eventNo: number): DocVerdict & { date?: string | null } {
  const m = b.startPdf?.map.get(key);
  if (!b.startPdf || !m) return { kind: "unknown" };
  const s = m.get(eventNo);
  return { ...(s ?? { kind: "absent" as const }), date: b.startPdf.date };
}

interface Target {
  swimmer: Swimmer;
  eventNo: number;
  disc: string; // CSPS code "100 Z"
  app: csps.CspsEntryRow | null; // null = no longer in CSPS applications
  row: EntryRow | null;
}

interface EntryRow extends EntrySnapshot {
  id: string;
  swimmer_id: string;
  competition_csps_id: number;
  event_no: number;
  discipline: string;
  swim_date: string | null;
  category_id: number | null;
  places_checked_at: string | null;
  field: unknown;
  source: string | null;
  history: HistoryItem[];
}

// heats stored before names were kept are refreshed once from the results
const unnamed = (f: unknown) => ((f as RaceField | null)?.racers ?? []).some((r) => !r.me && r.name === undefined);

const snapOf = (r: EntryRow): EntrySnapshot => ({
  status: r.status,
  reserve_no: r.reserve_no,
  heat: r.heat,
  heat_count: r.heat_count,
  lane: r.lane,
  result_ms: r.result_ms,
});

interface ScanOptions {
  live?: boolean; // only meets with entries around today (cheap, for frequent polling on race days)
  backfillFrom?: string; // also rebuild meets swum since this date (YYYY-MM-DD)
}

export async function scanEntries(opts: ScanOptions = {}): Promise<{ competitions: number; changes: number; notes: string[] }> {
  const notes: string[] = [];
  const { data: swimmerRows } = await db().from("swim_swimmers").select("*").eq("active", true);
  const swimmers = (swimmerRows ?? []) as Swimmer[];
  if (!swimmers.length) return { competitions: 0, changes: 0, notes };
  const byUserId = new Map(swimmers.map((s) => [s.csps_user_id, s]));
  const byId = new Map(swimmers.map((s) => [s.id, s]));
  const keyOf = (s: Swimmer) => personKey(`${s.last_name} ${s.first_name}`, s.birth_year);

  const today = pragueToday();
  const now = pragueNow();

  // --- which meets to look at
  const wanted = new Map<number, { title: string; location: string | null; poolLength: number | null; startDate: string; endDate: string | null; hasResults: boolean }>();
  const year = Number(today.slice(0, 4));
  let list: csps.CspsCompetitionRow[] = [];
  try {
    list = await csps.getCompetitions(year);
    if (addDays(today, 21).slice(0, 4) !== String(year)) list = list.concat(await csps.getCompetitions(year + 1));
    if (opts.backfillFrom && opts.backfillFrom.slice(0, 4) !== String(year)) list = list.concat(await csps.getCompetitions(year - 1));
  } catch (e) {
    notes.push(`competitions: ${(e as Error).message}`);
  }
  const listed = new Map(list.map((c) => [c.competitionId, c]));
  const add = (id: number) => {
    const c = listed.get(id);
    if (c && c.sport === 1 && !c.masters)
      wanted.set(id, {
        title: c.title,
        location: c.location,
        poolLength: c.poolLength,
        startDate: c.startDate.slice(0, 10),
        endDate: c.endDate?.slice(0, 10) ?? null,
        hasResults: c.hasResults,
      });
  };

  if (opts.live) {
    const { data } = await db()
      .from("swim_entries")
      .select("competition_csps_id")
      .gte("swim_date", addDays(today, -1))
      .lte("swim_date", addDays(today, 1));
    for (const r of data ?? []) add(Number(r.competition_csps_id));
  } else {
    const from = addDays(today, -3);
    const to = addDays(today, 21);
    for (const c of list) {
      const d = c.startDate?.slice(0, 10);
      if (d && d >= from && d <= to) add(c.competitionId);
    }
    if (opts.backfillFrom) {
      const { data } = await db()
        .from("swim_results")
        .select("competition_csps_id")
        .gte("swim_date", opts.backfillFrom)
        .not("competition_csps_id", "is", null);
      for (const r of data ?? []) add(Number(r.competition_csps_id));
    }
  }

  let changes = 0;
  let scanned = 0;
  for (const [cid, comp] of wanted) {
    let program: { halfDays: csps.CspsHalfDay[]; entries: csps.CspsEntryRow[] };
    try {
      program = await csps.getCompetitionEntries(cid);
    } catch {
      continue; // applications not public for this meet
    }
    const ours = program.entries.filter((e) => byUserId.has(e.userId));
    const { data: existingData } = await db().from("swim_entries").select("*").eq("competition_csps_id", cid);
    const existing = (existingData ?? []) as EntryRow[];
    if (!ours.length && !existing.length) continue;
    scanned += 1;

    const raceStarted = comp.startDate <= today;
    const isPast = (comp.endDate ?? comp.startDate) < today;
    const near = comp.startDate <= addDays(today, 10) && (comp.endDate ?? comp.startDate) >= addDays(today, -2);

    let docs: csps.CspsCompetitionDocs | null = null;
    try {
      docs = await csps.getCompetitionDocs(cid);
    } catch (e) {
      notes.push(`docs ${cid}: ${(e as Error).message}`);
    }
    const involved = new Set<string>([...ours.map((e) => byUserId.get(e.userId)!.id), ...existing.map((r) => r.swimmer_id)]);
    const keys = new Set([...involved].map((id) => byId.get(id)).filter((s): s is Swimmer => !!s).map(keyOf));
    const fetchDocs = docs && (near || (opts.backfillFrom != null && !existing.length));
    const bundle = fetchDocs ? await loadDocs(cid, docs!.documents, keys, notes) : NO_DOCS;

    const { data: resData } = await db()
      .from("swim_results")
      .select("swimmer_id,discipline,time_ms,is_dsq,points,swim_date")
      .eq("competition_csps_id", cid)
      .eq("is_split", false)
      .in("swimmer_id", [...involved]);
    const results = resData ?? [];

    // targets: current applications + previously known rows (to notice withdrawals)
    const targets = new Map<string, Target>();
    for (const e of ours) {
      const s = byUserId.get(e.userId)!;
      targets.set(`${s.id}|${e.eventNo}|${e.disciplineCode}`, { swimmer: s, eventNo: e.eventNo, disc: e.disciplineCode, app: e, row: null });
    }
    for (const r of existing) {
      const k = `${r.swimmer_id}|${r.event_no}|${r.discipline}`;
      const s = byId.get(r.swimmer_id);
      if (!s) continue;
      const t = targets.get(k);
      if (t) t.row = r;
      else targets.set(k, { swimmer: s, eventNo: r.event_no, disc: r.discipline, app: null, row: r });
    }
    // CSPS sometimes returns no applications at all (closed meet) — never treat that as withdrawals
    const appsReliable = program.entries.length > 0;

    const halfDay = new Map(program.halfDays.map((h) => [h.order, h]));
    const primaryChanges: string[] = [];
    const placesTodo: { swimmer: Swimmer; eventNo: number; disc: string; catId: number }[] = [];
    const isNewMeet = !existing.length;

    for (const t of targets.values()) {
      if (!t.app && !appsReliable) continue;
      const key = keyOf(t.swimmer);
      const disc = normDisc(t.disc);
      const res = results.filter((r) => r.swimmer_id === t.swimmer.id && r.discipline === t.disc);
      const valid = res.filter((r) => !r.is_dsq && r.time_ms < csps.DSQ_THRESHOLD).sort((a, b) => a.time_ms - b.time_ms);
      const result = valid[0]
        ? { ms: valid[0].time_ms as number, dsq: false, points: valid[0].points as number | null }
        : res.length
          ? { ms: res[0].time_ms as number, dsq: true, points: null }
          : null;

      const base: StatusInputs = {
        inApplications: !!t.app,
        overLimit: t.app?.overLimit ?? false,
        raceStarted,
        raceOver: false, // intermediate stages describe the situation before the race
        omega: { kind: "unknown" },
        accepted: { kind: "unknown" },
        startPdf: { kind: "unknown" },
        result: null,
      };
      // staged resolution, oldest source first, so a first-seen meet gets its full story
      const stages: { inputs: StatusInputs; at: string }[] = [];
      const regEnd = docs?.registrationEndDate?.slice(0, 16) ?? null;
      stages.push({ inputs: base, at: regEnd && regEnd < now ? regEnd : now });
      let cur = base;
      const pdfStages = [
        { v: acceptedVerdict(bundle, key, t.eventNo, disc), field: "accepted" as const },
        { v: startPdfVerdict(bundle, key, t.eventNo), field: "startPdf" as const },
      ]
        .filter((p) => p.v.kind !== "unknown")
        .sort((a, b) => (a.v.date ?? "9").localeCompare(b.v.date ?? "9"));
      for (const p of pdfStages) {
        cur = p.field === "accepted" ? { ...cur, accepted: p.v } : { ...cur, startPdf: p.v };
        stages.push({ inputs: cur, at: p.v.date?.slice(0, 16) ?? now });
      }
      const om = omegaVerdict(bundle.omega, key, t.eventNo, disc);
      if (om.kind !== "unknown") {
        cur = { ...cur, omega: om };
        stages.push({ inputs: cur, at: isPast ? `${comp.startDate}T07:00` : now });
      }
      if (result) {
        cur = { ...cur, result: { ms: result.ms, dsq: result.dsq } };
        stages.push({ inputs: cur, at: isPast ? `${t.app?.date ?? comp.startDate}T20:00` : now });
      }

      if (isPast) {
        cur = { ...cur, raceOver: true };
        stages.push({ inputs: cur, at: `${t.app?.date ?? t.row?.swim_date ?? comp.startDate}T20:00` });
      }
      let final = resolveStatus(cur);
      // Documents are only fetched around race day. Outside that window a row built from documents must not be
      // re-resolved from CSPS flags alone (heats, lanes and reserve order would be lost) — apply only what can change.
      if (t.row && !fetchDocs && t.row.source && t.row.source !== "csps") {
        let snap = snapOf(t.row);
        if (result) snap = { ...snap, status: result.dsq ? "dsq" : "swum", reserve_no: null, result_ms: result.ms };
        else if (!t.app && !raceStarted) snap = snapshot({ status: "withdrawn" });
        else if (isPast && (snap.status === "reserve" || snap.status === "entered")) snap = { ...snap, status: "not_accepted" };
        final = { snap, source: result ? "results" : t.row.source };
      }
      let history: HistoryItem[];
      if (t.row) {
        const prev = snapOf(t.row);
        history = t.row.history ?? [];
        if (changed(prev, final.snap)) {
          history = [...history, { at: now, from: prev, to: final.snap, source: final.source }];
          changes += 1;
          if (t.swimmer.is_primary) {
            const txt = changeText(disciplineLabel(t.disc), prev, final.snap, fmtTime);
            primaryChanges.push(txt ?? `${disciplineLabel(t.disc)}: ${statusLabel(final.snap).label}`);
          }
        }
      } else {
        history = [];
        let last: EntrySnapshot | null = null;
        let lastAt = "";
        for (const st of stages) {
          const r = resolveStatus(st.inputs);
          if (last && !changed(last, r.snap)) continue;
          const at = st.at < lastAt ? lastAt : st.at;
          history.push({ at, from: last, to: r.snap, source: r.source });
          last = r.snap;
          lastAt = at;
        }
      }

      const h = t.app ? halfDay.get(t.app.halfDay) : undefined;
      const row = {
        swimmer_id: t.swimmer.id,
        competition_csps_id: cid,
        event_no: t.eventNo,
        discipline: t.disc,
        ...(t.app?.categoryId ? { category_id: t.app.categoryId } : {}),
        ...(t.app
          ? {
              discipline_title: t.app.disciplineTitle,
              category_text: t.app.categoryText,
              half_day: t.app.halfDay,
              swim_date: t.app.date,
              warmup_min: h?.warmupMin ?? null,
              start_min: h?.startMin ?? null,
              seed_ms: t.app.seedMs,
              seed_location: t.app.seedLocation,
              seed_date: t.app.seedDate,
            }
          : {}),
        ...final.snap,
        result_points: result?.points ?? null,
        source: final.source,
        history,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db().from("swim_entries").upsert(row, { onConflict: "swimmer_id,competition_csps_id,event_no,discipline" });
      if (error) notes.push(`entry ${cid}/${t.eventNo}: ${error.message}`);
      // before the race: her heat from the start list (lanes, years, clubs, entry times) — replaced by results later
      if (final.snap.status === "drawn" && final.snap.heat != null && bundle.omega?.length) {
        const lineup = heatLineup(bundle.omega, t.eventNo, final.snap.heat, key);
        if (lineup.some((r) => r.me)) {
          const pre: RaceField = {
            heat: final.snap.heat,
            pre: true,
            racers: lineup.map((r) => ({ lane: r.lane, year: r.year, time: r.seedMs ?? 0, me: r.me, club: r.club, name: r.name })),
            year: [],
          };
          await db()
            .from("swim_entries")
            .update({ field: pre })
            .eq("swimmer_id", t.swimmer.id)
            .eq("competition_csps_id", cid)
            .eq("event_no", t.eventNo)
            .eq("discipline", t.disc);
        }
      }
      const catId = t.app?.categoryId ?? t.row?.category_id ?? null;
      const recent = (comp.endDate ?? comp.startDate) >= addDays(today, -2);
      if (catId && (final.snap.status === "swum" || final.snap.status === "dsq") && (!t.row?.places_checked_at || recent || !t.row?.field || unnamed(t.row.field))) {
        placesTodo.push({ swimmer: t.swimmer, eventNo: t.eventNo, disc: t.disc, catId });
      }
    }

    // --- placings from the category results: overall and within the swimmer's birth year
    const outputsByCat = new Map<number, csps.OwOutput[]>();
    for (const p of placesTodo) {
      if (!outputsByCat.has(p.catId)) {
        try {
          outputsByCat.set(p.catId, await csps.getCategoryOutputs(p.catId));
        } catch (e) {
          notes.push(`places ${cid}/${p.catId}: ${(e as Error).message}`);
          outputsByCat.set(p.catId, []);
        }
      }
      // CSPS imports results days after the meet; until then the organiser's LENEX file has the same results
      let outs: csps.OwOutput[] = outputsByCat.get(p.catId)!;
      if (!outs.length && bundle.lenex) outs = lenexOutputs(bundle.lenex, p.eventNo, csps.DSQ_THRESHOLD + 39_990);
      if (!outs.length) continue;
      const valid = outs.filter((o) => o.order > 0 && o.time > 0 && o.time < csps.DSQ_THRESHOLD);
      const me = valid.find((o) => o.userId === p.swimmer.csps_user_id);
      const sameYear = valid.filter((o) => o.birthYear === p.swimmer.birth_year).sort((a, b) => a.time - b.time);
      const heatNo = outs.find((o) => o.userId === p.swimmer.csps_user_id)?.heat ?? null;
      const field: RaceField = {
        heat: heatNo,
        racers:
          heatNo == null
            ? []
            : valid
                .filter((o) => o.heat === heatNo && o.lane != null)
                .map((o) => ({ lane: o.lane as number, year: o.birthYear, time: o.time, me: o.userId === p.swimmer.csps_user_id, club: o.club, name: o.name }))
                .sort((a, b) => a.lane - b.lane),
        year: sameYear.map((o) => o.time),
        yearNames: sameYear.map((o) => o.name),
        yearClubs: sameYear.map((o) => o.club),
        ...(me ? { yearMe: sameYear.indexOf(me) } : {}),
      };
      const { error } = await db()
        .from("swim_entries")
        .update({
          place_overall: me ? me.order : null,
          field_overall: valid.length,
          place_year: me ? sameYear.filter((o) => o.time < me.time).length + 1 : null,
          field_year: sameYear.length,
          field,
          places_checked_at: new Date().toISOString(),
        })
        .eq("swimmer_id", p.swimmer.id)
        .eq("competition_csps_id", cid)
        .eq("event_no", p.eventNo)
        .eq("discipline", p.disc);
      if (error) notes.push(`places ${cid}/${p.eventNo}: ${error.message}`);
    }

    // --- meet metadata
    const { data: compRow } = await db().from("swim_competitions").select("entries").eq("csps_id", cid).maybeSingle();
    const legacy: Record<string, { disc: string; status: string; seed: number | null }[]> = {};
    for (const e of ours) {
      const k = String(e.userId);
      (legacy[k] ??= []).push({ disc: e.disciplineCode, status: e.overLimit ? "reserve" : "entered", seed: e.seedMs });
    }
    const hasStartlist = !!(bundle.omega?.length || bundle.startPdf || docs?.documents.some((d) => d.type.startsWith("START_LIST")));
    const { error: compErr } = await db().from("swim_competitions").upsert(
      {
        csps_id: cid,
        title: comp.title,
        location: comp.location,
        pool_length: comp.poolLength,
        start_date: comp.startDate,
        end_date: comp.endDate,
        entries: Object.keys(legacy).length ? legacy : (compRow?.entries ?? null),
        has_startlist: hasStartlist,
        startlist_source: bundle.omega?.length ? "csv" : bundle.startPdf ? "pdf" : null,
        has_accepted: !!docs?.documents.some((d) => d.type === "C_FILE_ACCEPTED"),
        has_results: comp.hasResults || results.length > 0,
        registration_end: docs?.registrationEndDate ?? null,
        deregistration_end: docs?.deregistrationEndDate ?? null,
        state: docs?.competitionState ?? null,
        halfdays: program.halfDays,
        documents: docs ? publicDocs(cid, docs.documents) : null,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "csps_id" }
    );
    if (compErr) notes.push(`competition ${cid}: ${compErr.message}`);

    // --- notifications (parent Telegram)
    const when = comp.startDate.split("-").reverse().join(". ").replace(/^0/, "");
    if (isNewMeet && !compRow?.entries && !isPast) {
      const lines: string[] = [];
      for (const s of swimmers) {
        const mine = ours.filter((e) => e.userId === s.csps_user_id).sort((a, b) => a.eventNo - b.eventNo);
        if (!mine.length) continue;
        const who = s.is_primary ? "🏊‍♀️ <b>Viki</b>" : `${s.first_name} ${s.last_name}`;
        lines.push(`${who}: ${mine.map((e) => `${disciplineLabel(e.disciplineCode)}${e.overLimit ? " (náhradnice)" : ""}`).join(", ")}`);
      }
      if (lines.length) await sendTelegram(`📋 <b>Na startovce</b> — ${comp.title}, ${when} ${comp.location ?? ""}\n${lines.join("\n")}`);
    } else if (primaryChanges.length) {
      await sendTelegram(`🔔 <b>Viki</b> · ${comp.title} (${when})\n${primaryChanges.map((l) => `• ${l}`).join("\n")}`);
    }
  }
  return { competitions: scanned, changes, notes };
}
