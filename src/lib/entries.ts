// Entry status model for upcoming races — shared by the sync engine and the UI.
// Pure (no imports) so it can be unit-tested directly with node --test.

export type EntryStatus =
  | "entered" // přihlášená, čeká se na uzávěrky
  | "reserve" // náhradnice (pod čarou), může postoupit po odhláškách
  | "accepted" // přijatá, rozplavby se teprve losují
  | "drawn" // rozlosovaná: rozplavba + dráha
  | "not_accepted" // nevešla se / nepostoupila z náhradnic
  | "withdrawn" // odhlášená
  | "swum" // odplaváno, je výsledek
  | "dsq"; // diskvalifikace

export interface EntrySnapshot {
  status: EntryStatus;
  reserve_no: number | null;
  heat: number | null;
  heat_count: number | null;
  lane: number | null;
  result_ms: number | null;
}

export interface HistoryItem {
  at: string;
  from: EntrySnapshot | null;
  to: EntrySnapshot;
  source: string;
}

export type Tone = "wait" | "reserve" | "ok" | "drawn" | "off" | "done" | "dsq";

// Who swam with her: her heat (lane, birth year, time) and every time of her birth year in that event.
export interface RaceField {
  heat: number | null;
  racers: { lane: number; year: number; time: number; me: boolean }[];
  year: number[]; // sorted times of swimmers born the same year (hers included)
}

export const EMPTY: EntrySnapshot = { status: "entered", reserve_no: null, heat: null, heat_count: null, lane: null, result_ms: null };

export function snapshot(s: Partial<EntrySnapshot> & { status: EntryStatus }): EntrySnapshot {
  return { ...EMPTY, ...s };
}

export function sameSnapshot(a: EntrySnapshot, b: EntrySnapshot): boolean {
  return (
    a.status === b.status &&
    a.reserve_no === b.reserve_no &&
    a.heat === b.heat &&
    a.heat_count === b.heat_count &&
    a.lane === b.lane &&
    a.result_ms === b.result_ms
  );
}

// A change worth telling about: ignores refinements like the heat count appearing later.
export function changed(a: EntrySnapshot, b: EntrySnapshot): boolean {
  return a.status !== b.status || a.reserve_no !== b.reserve_no || a.heat !== b.heat || a.lane !== b.lane || a.result_ms !== b.result_ms;
}

// Is this entry still "in play" for the race (she will or did swim it)?
export function isIn(s: EntryStatus): boolean {
  return s === "accepted" || s === "drawn" || s === "swum" || s === "dsq";
}

export function isOut(s: EntryStatus): boolean {
  return s === "not_accepted" || s === "withdrawn";
}

// ---- resolving the status from all sources ---------------------------------
// Precedence: real result > OMEGA start list (machine export of the final draw) >
// the newer of the organiser PDFs (accepted list / start list) > CSPS application flags.

export type DocVerdict =
  | { kind: "drawn"; heat: number; lane: number; heatCount: number | null }
  | { kind: "reserve"; no: number | null }
  | { kind: "accepted" }
  | { kind: "not_accepted" }
  | { kind: "absent" } // swimmer is in the document, this race is not
  | { kind: "unknown" }; // document missing or swimmer not found in it

export interface StatusInputs {
  inApplications: boolean;
  overLimit: boolean;
  raceStarted: boolean; // race day reached — application lists stop being authoritative
  raceOver: boolean; // race day passed — a reserve without a result did not get in
  omega: DocVerdict;
  accepted: DocVerdict & { date?: string | null };
  startPdf: DocVerdict & { date?: string | null };
  result: { ms: number; dsq: boolean } | null;
}

function fromVerdict(v: DocVerdict, absentMeans: EntryStatus): EntrySnapshot | null {
  switch (v.kind) {
    case "drawn":
      return snapshot({ status: "drawn", heat: v.heat, lane: v.lane, heat_count: v.heatCount });
    case "reserve":
      return snapshot({ status: "reserve", reserve_no: v.no });
    case "accepted":
      return snapshot({ status: "accepted" });
    case "not_accepted":
      return snapshot({ status: "not_accepted" });
    case "absent":
      return snapshot({ status: absentMeans });
    default:
      return null;
  }
}

export function resolveStatus(i: StatusInputs): { snap: EntrySnapshot; source: string } {
  // best organiser-document verdict
  let doc: { snap: EntrySnapshot; source: string } | null = null;
  const omega = fromVerdict(i.omega, "not_accepted");
  if (omega) {
    doc = { snap: omega, source: "startlist_csv" };
    // OMEGA marks reserves as heat 0 without their order — borrow it from a PDF when available
    if (omega.status === "reserve") {
      const no = [i.startPdf, i.accepted].find((v) => v.kind === "reserve") as { no: number | null } | undefined;
      if (no?.no) doc.snap = { ...omega, reserve_no: no.no };
    }
  } else {
    const pdfs = [
      { v: i.startPdf, source: "startlist_pdf", absent: "not_accepted" as EntryStatus },
      { v: i.accepted, source: "accepted_pdf", absent: "withdrawn" as EntryStatus },
    ]
      .map((p) => ({ ...p, snap: fromVerdict(p.v, p.absent) }))
      .filter((p) => p.snap);
    // newer document wins; on unknown/equal dates the start list (later stage) wins
    pdfs.sort((a, b) => (b.v.date ?? "").localeCompare(a.v.date ?? ""));
    if (pdfs[0]) doc = { snap: pdfs[0].snap!, source: pdfs[0].source };
  }

  if (i.result) {
    const base = doc && doc.snap.status === "drawn" ? doc.snap : EMPTY;
    return {
      snap: { ...base, status: i.result.dsq ? "dsq" : "swum", reserve_no: null, result_ms: i.result.ms },
      source: "results",
    };
  }
  if (!i.inApplications && !i.raceStarted) return { snap: snapshot({ status: "withdrawn" }), source: "csps" };
  const out = doc ?? { snap: snapshot({ status: i.overLimit ? "reserve" : "entered" }), source: "csps" };
  if (i.raceOver && (out.snap.status === "reserve" || out.snap.status === "entered")) {
    return { snap: { ...out.snap, status: "not_accepted" }, source: out.source };
  }
  return out;
}

// ---- wording ----------------------------------------------------------------

export function statusLabel(s: EntrySnapshot): { label: string; hint: string; tone: Tone } {
  switch (s.status) {
    case "entered":
      return { label: "Přihlášená", hint: "čeká se na seznam po odhláškách", tone: "wait" };
    case "reserve":
      return {
        label: s.reserve_no ? `Náhradnice č. ${s.reserve_no}` : "Náhradnice",
        hint: "když se někdo odhlásí, může se dostat do závodu",
        tone: "reserve",
      };
    case "accepted":
      return { label: "Potvrzeno", hint: "rozplavby se teprve losují", tone: "ok" };
    case "drawn":
      return {
        label: `Rozplavba ${s.heat}${s.heat_count ? `/${s.heat_count}` : ""} · dráha ${s.lane}`,
        hint: "rozlosováno",
        tone: "drawn",
      };
    case "not_accepted":
      return { label: "Tentokrát ne", hint: "pořadatel musel omezit počet startů", tone: "off" };
    case "withdrawn":
      return { label: "Odhlášeno", hint: "tuhle trať nepoplave", tone: "off" };
    case "swum":
      return { label: "Odplaváno", hint: "", tone: "done" };
    case "dsq":
      return { label: "Diskvalifikace", hint: "tentokrát se čas nepočítá", tone: "dsq" };
  }
}

// Kid-friendly one-liner for a change; null when not worth showing.
export function changeText(disc: string, from: EntrySnapshot | null, to: EntrySnapshot, fmtTime: (ms: number) => string): string | null {
  if (!from) {
    if (to.status === "reserve") return `${disc}: jsi náhradnice${to.reserve_no ? ` č. ${to.reserve_no}` : ""}`;
    return null; // first-seen entries are summarised per race
  }
  if (sameSnapshot(from, to)) return null;
  const wasWaiting = from.status === "reserve";
  switch (to.status) {
    case "drawn":
      if (wasWaiting) return `${disc}: postoupila jsi z náhradnic! Rozplavba ${to.heat}, dráha ${to.lane}`;
      return `${disc}: rozlosováno — rozplavba ${to.heat}, dráha ${to.lane}`;
    case "accepted":
      return wasWaiting ? `${disc}: postoupila jsi z náhradnic do závodu!` : `${disc}: potvrzeno, poplaveš`;
    case "reserve":
      if (wasWaiting && from.reserve_no && to.reserve_no && to.reserve_no < from.reserve_no)
        return `${disc}: posunula ses na ${to.reserve_no}. náhradnici`;
      if (wasWaiting) return null;
      return `${disc}: jsi náhradnice${to.reserve_no ? ` č. ${to.reserve_no}` : ""}`;
    case "not_accepted":
      return `${disc}: tentokrát se nevešla`;
    case "withdrawn":
      return `${disc}: odhlášeno`;
    case "swum":
      return to.result_ms != null ? `${disc}: odplaváno za ${fmtTime(to.result_ms)}` : `${disc}: odplaváno`;
    case "dsq":
      return `${disc}: diskvalifikace`;
    default:
      return null;
  }
}

// ---- race process stepper ----------------------------------------------------

export type StepState = "done" | "now" | "todo";

export interface RaceStep {
  key: "prihlaska" | "odhlasky" | "rozlosovani" | "zavod" | "vysledky";
  label: string;
  when: string | null; // ISO local date-time or date
  state: StepState;
}

export function raceSteps(c: {
  nowLocal: string; // "YYYY-MM-DDTHH:MM" Prague wall time
  registrationEnd: string | null;
  deregistrationEnd: string | null;
  startDate: string;
  endDate: string | null;
  drawn: boolean;
  hasAccepted: boolean;
  hasResults: boolean;
}): RaceStep[] {
  const now = c.nowLocal;
  const today = now.slice(0, 10);
  const regDone = !c.registrationEnd || c.registrationEnd.slice(0, 16) <= now;
  const deregDone = c.hasAccepted || (!!c.deregistrationEnd && c.deregistrationEnd.slice(0, 16) <= now);
  const raceDone = (c.endDate ?? c.startDate) < today;
  const raceNow = c.startDate <= today && !raceDone;
  const steps: RaceStep[] = [
    { key: "prihlaska", label: "Přihláška", when: c.registrationEnd, state: regDone ? "done" : "now" },
    { key: "odhlasky", label: "Odhlášky", when: c.deregistrationEnd, state: deregDone ? "done" : regDone ? "now" : "todo" },
    { key: "rozlosovani", label: "Rozlosování", when: null, state: c.drawn || raceDone || raceNow ? "done" : deregDone ? "now" : "todo" },
    { key: "zavod", label: "Závod", when: c.startDate, state: raceDone || c.hasResults ? "done" : raceNow ? "now" : "todo" },
    { key: "vysledky", label: "Výsledky", when: null, state: c.hasResults ? "done" : raceDone || raceNow ? "now" : "todo" },
  ];
  return steps;
}
