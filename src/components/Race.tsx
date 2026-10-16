import Link from "next/link";
import RaceReplay from "@/components/anim/RaceReplay";
import type { ReplayParams } from "@/lib/anim/replay";
import Sparkline from "@/components/Sparkline";
import { ChevronGlyph, MedalGlyph, PinGlyph, SparkGlyph, StrokeGlyph } from "@/components/Glyphs";
import { LaneMap, StatusChip, StatusRope } from "@/components/Pool";
import { statusLabel, type EntrySnapshot, type RaceField } from "@/lib/entries";
import { fmtDate, fmtDelta, fmtTime } from "@/lib/format";
import { eventName, meetSummary, outHint, placeView, toneOf } from "@/lib/present";
import type { CompetitionRow, EntryRow } from "@/lib/queries";
import type { RecordRow } from "@/lib/records";
import { STROKE_META, strokeOf } from "@/lib/strokes";
import { relativeDay, shortDate, weekday } from "@/lib/time";

function stepText(s: EntrySnapshot): string {
  switch (s.status) {
    case "entered":
      return "přihláška";
    case "reserve":
      return s.reserve_no ? `náhradnice č. ${s.reserve_no}` : "náhradnice";
    case "accepted":
      return "potvrzeno";
    case "drawn":
      return `rozplavba ${s.heat}, dráha ${s.lane}`;
    case "swum":
      return s.result_ms != null ? fmtTime(s.result_ms) : "odplaváno";
    case "dsq":
      return "diskvalifikace";
    case "not_accepted":
      return "nevešla se";
    case "withdrawn":
      return "odhlášeno";
  }
}

export function EntryStory({ entry }: { entry: EntryRow }) {
  const steps = entry.history.map((h) => h.to);
  if (steps.length < 2) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-pool-900/55">
      {steps.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className="text-pool-300">→</span>}
          <span className={i === steps.length - 1 ? "font-semibold text-pool-900/75" : ""}>{stepText(s)}</span>
        </span>
      ))}
    </p>
  );
}

const girls = (n: number) => `${n} ${n < 5 ? "plavkyně" : "plavkyň"}`;

// one swimmer in a heat or birth-year list: her row says "ty"; the others go by name (public results), with year and club under it
function Person({ name, sub, me }: { name: string; sub?: string; me: boolean }) {
  return (
    <span className="min-w-0 flex-1 leading-tight">
      <span className="block truncate">{me ? "ty" : name}</span>
      {!me && sub && <span className="block truncate text-[11px] font-normal text-pool-900/45">{sub}</span>}
    </span>
  );
}

const subOf = (year: number | null | undefined, club: string | null | undefined) => [year || "", club ?? ""].filter(Boolean).join(" · ");

const rowCls = (me: boolean) => `flex items-center gap-3 py-1.5 text-sm ${me ? "-mx-1.5 rounded-xl bg-[#fff6d6] px-1.5 font-bold text-pool-900" : "text-pool-900/75"}`;
const badgeCls = (me: boolean) =>
  `grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold ${me ? "bg-[#ffe07a] text-[#7a4b00]" : "bg-pool-50 text-pool-700"}`;

// after the race: who swam in her heat and how her birth year finished, by name and time
export function FieldResults({ field, birthYear }: { field: RaceField; birthYear: number | null }) {
  const heat = field.racers.filter((r) => r.time > 0).sort((a, b) => a.time - b.time);
  const year =
    field.yearNames && field.yearNames.length === field.year.length
      ? field.year.map((t, i) => ({ t, name: field.yearNames![i], club: field.yearClubs?.[i] ?? "", me: i === field.yearMe }))
      : null;
  const showHeat = heat.length > 1 && heat.some((r) => !r.me && r.name);
  const showYear = !!year && year.length > 1;
  if (!showHeat && !showYear) return null;
  return (
    <details className="group mt-3 rounded-2xl ring-1 ring-pool-100">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-pool-800 [&::-webkit-details-marker]:hidden">
        Kdo plaval s tebou
        <ChevronGlyph size={18} className="shrink-0 text-pool-400 transition group-open:rotate-90" />
      </summary>
      <div className="space-y-3 px-3 pb-2">
        {showHeat && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pool-900/45">
              Rozplavba {field.heat} · {girls(heat.length)}
            </p>
            <ol className="divide-y divide-pool-50">
              {heat.map((r, i) => (
                <li key={r.lane} className={rowCls(r.me)}>
                  <span className={badgeCls(r.me)}>{i + 1}.</span>
                  <Person name={r.name ?? subOf(r.year, r.club)} sub={r.name ? subOf(r.year, r.club) : undefined} me={r.me} />
                  <span className="nums shrink-0">{fmtTime(r.time)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {showYear && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pool-900/45">
              Ročník {birthYear ?? ""} · {girls(year!.length)}
            </p>
            <ol className="divide-y divide-pool-50">
              {year!.map((r, i) => (
                <li key={i} className={rowCls(r.me)}>
                  <span className={badgeCls(r.me)}>{i + 1}.</span>
                  <Person name={r.name} sub={r.club} me={r.me} />
                  <span className="nums shrink-0">{fmtTime(r.t)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </details>
  );
}

export function EventCard({
  entry,
  birthYear,
  parent,
  kidPlaces,
  pb,
  delay = 0,
  firstEver = false,
  replay,
  lineup,
  preview,
  results,
}: {
  entry: EntryRow;
  birthYear: number | null;
  parent: boolean;
  kidPlaces: boolean;
  pb?: "pb" | "first" | "first_pool" | null;
  delay?: number;
  firstEver?: boolean;
  replay?: ReplayParams;
  lineup?: RaceField | null; // her heat from the start list (before the race)
  preview?: ReplayParams; // the heat swum at everyone's entry times
  results?: RaceField | null; // her heat and birth year after the race
}) {
  const st = statusLabel(entry);
  const stroke = strokeOf(entry.discipline);
  const place = placeView(entry, birthYear, { parent, kidPlaces });
  const out = entry.status === "not_accepted" || entry.status === "withdrawn";
  // the story is worth showing when the entry moved (e.g. reserve -> into the race); out-entries say it in the hint
  const showStory = !out && (parent || entry.history.some((h) => h.to.status === "reserve"));
  return (
    <article
      className={`animate-rise rounded-3xl border bg-white p-4 shadow-[0_6px_18px_-12px_rgb(8_42_60/0.45)] ${out ? "border-pool-100 opacity-75" : "border-pool-100"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pool-50 ring-1 ring-pool-100">
            <StrokeGlyph stroke={stroke} size={30} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-pool-900/40">č. {entry.event_no}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-bold leading-tight text-pool-900">{eventName(entry.discipline)}</h3>
            {entry.status !== "swum" && <StatusChip tone={st.tone}>{st.label}</StatusChip>}
          </div>
          {entry.status === "swum" && entry.result_ms != null ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="display nums text-[2rem] font-extrabold leading-none text-pool-900">{fmtTime(entry.result_ms)}</span>
              {pb === "pb" && (
                <span className="pb-shimmer inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[#5a3900]">
                  <SparkGlyph size={13} /> osobák
                </span>
              )}
              {pb === "first" && <StatusChip tone="wait">první start</StatusChip>}
              {pb === "first_pool" && <StatusChip tone="wait">poprvé v tomhle bazénu</StatusChip>}
              {place && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-pool-800">
                  {place.medal && <MedalGlyph place={place.medal} size={24} />}
                  {place.main}
                  {place.of && <span className="font-normal text-pool-900/50">{place.of}</span>}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-pool-900/60">
              {entry.seed_ms ? (
                <>
                  přihlášený čas <b className="nums font-semibold text-pool-900/80">{fmtTime(entry.seed_ms)}</b>
                </>
              ) : (
                firstEver ? "tuhle trať poplave poprvé" : "bez přihlášeného času"
              )}
            </p>
          )}
          {out && <p className="mt-1 text-xs text-pool-900/50">{outHint(entry)}</p>}
          {entry.status === "reserve" && <p className="mt-1 text-xs text-[#8a5300]/80">{st.hint}</p>}
          {place?.overall && <p className="mt-1 text-xs text-pool-900/45">{place.overall}</p>}
          {showStory && <EntryStory entry={entry} />}
        </div>
      </div>
      {replay && <RaceReplay params={replay} />}
      {results && <FieldResults field={results} birthYear={birthYear} />}
      {entry.status === "drawn" && entry.lane != null && (
        <div className="mt-3 flex items-center gap-4 rounded-2xl bg-pool-50 p-3 ring-1 ring-pool-100">
          <LaneMap lane={entry.lane} label={`dráha ${entry.lane}`} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pool-900/45">
              rozplavba {entry.heat}
              {entry.heat_count ? ` z ${entry.heat_count}` : ""}
            </p>
            <p className="display text-3xl font-extrabold leading-none text-pool-900">dráha {entry.lane}</p>
          </div>
        </div>
      )}
      {lineup && lineup.racers.length > 1 && (
        <div className="mt-3 rounded-2xl ring-1 ring-pool-100">
          <p className="px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-pool-900/45">
            Tvoje rozplavba · {girls(lineup.racers.length)}
          </p>
          <ul className="divide-y divide-pool-50 px-3 pb-1">
            {lineup.racers.map((r) => (
              <li key={r.lane} className={rowCls(r.me)}>
                <span className={badgeCls(r.me)}>{r.lane}</span>
                <Person name={r.name ?? subOf(r.year, r.club)} sub={r.name ? subOf(r.year, r.club) : undefined} me={r.me} />
                <span className="nums shrink-0">{r.time > 0 ? fmtTime(r.time) : "bez času"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview && <RaceReplay params={preview} label="Jak by to dopadlo podle přihlášených časů" />}
    </article>
  );
}

export function PoolBadge({ length }: { length: number | null }) {
  if (!length) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-white/25">
      {length} m bazén
    </span>
  );
}

export function MeetCard({ comp, entries, href, today }: { comp: CompetitionRow; entries: EntryRow[]; href: string; today: string }) {
  const rel = relativeDay(comp.start_date, today);
  return (
    <Link
      href={href}
      className="animate-rise group block rounded-3xl border border-pool-100 bg-white p-4 shadow-[0_10px_24px_-16px_rgb(8_42_60/0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgb(8_42_60/0.55)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-pool-600">
            {rel === "dnes" ? "dnes závodíš" : rel === "zítra" ? "zítra" : rel} · {weekday(comp.start_date)} {shortDate(comp.start_date)}
          </p>
          <h3 className="mt-0.5 text-xl font-extrabold leading-tight text-pool-900">{comp.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-pool-900/55">
            <PinGlyph size={14} /> {comp.location}
            {comp.pool_length ? ` · ${comp.pool_length} m` : ""}
          </p>
        </div>
        <ChevronGlyph size={22} className="mt-1 shrink-0 text-pool-300 transition group-hover:translate-x-0.5 group-hover:text-pool-500" />
      </div>
      {entries.length > 0 && (
        <div className="mt-3">
          <StatusRope tones={entries.map(toneOf)} />
          <p className="mt-1.5 text-sm font-medium text-pool-900/70">{meetSummary(entries)}</p>
        </div>
      )}
    </Link>
  );
}

export function RecordCard({ r, delay = 0 }: { r: RecordRow; delay?: number }) {
  const color = STROKE_META[r.stroke].color;
  return (
    <article
      className="animate-rise relative overflow-hidden rounded-3xl border border-pool-100 bg-white p-4 shadow-[0_6px_18px_-12px_rgb(8_42_60/0.45)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color }}>
            {r.distance} m
          </p>
          <p className="display nums mt-0.5 text-[2.1rem] font-extrabold leading-none text-pool-900">{fmtTime(r.best.time_ms)}</p>
          <p className="mt-1.5 text-xs text-pool-900/55">
            {fmtDate(r.best.swim_date)} · {r.best.location}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.best.points != null && <StatusChip tone="done">{r.best.points} bodů</StatusChip>}
            {r.fromSplit && <StatusChip tone="wait">mezičas z delší trati</StatusChip>}
            {r.gainMs != null && <StatusChip tone="ok">{fmtDelta(-r.gainMs)} od prvního startu</StatusChip>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.series.length >= 2 && <Sparkline values={r.series} width={96} height={34} stroke={color} />}
          <span className="text-[11px] text-pool-900/40">
            {r.starts === 0 ? "jen mezičas" : `${r.starts} ${r.starts === 1 ? "start" : r.starts < 5 ? "starty" : "startů"}`}
          </span>
        </div>
      </div>
    </article>
  );
}
