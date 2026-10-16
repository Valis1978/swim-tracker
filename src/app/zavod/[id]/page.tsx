import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { DocGlyph, PinGlyph } from "@/components/Glyphs";
import { RaceStepper, SectionTitle, StatusChip, StatusRope, WaterHero } from "@/components/Pool";
import { EventCard, PoolBadge } from "@/components/Race";
import MomentCard from "@/components/anim/MomentCard";
import { diveMoment } from "@/lib/moments";
import { previewParamsFor, replayParamsFor } from "@/lib/replay_params";
import { requireRole } from "@/lib/auth";
import { raceSteps, statusLabel } from "@/lib/entries";
import { fmtTime } from "@/lib/format";
import { eventName, halfDayName, halfDayTimes, meetSummary, toneOf } from "@/lib/present";

const NICK = "Viki";
import { getCompetition, getCompetitionEntries, getLook, getPrimary, getResults, kidSeesPlaces, type EntryRow } from "@/lib/queries";
import { pbFlags } from "@/lib/records";
import { pragueNow, relativeDay, shortDate, weekday } from "@/lib/time";

export const dynamic = "force-dynamic";

const KID_DOCS = new Set(["COMPETITION_PLAN", "START_LIST_PDF", "RESULTS_PDF"]);

export default async function ZavodPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireRole();
  const parent = role === "parent";
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) notFound();

  const [comp, primary] = await Promise.all([getCompetition(cid), getPrimary()]);
  if (!comp || !primary) notFound();
  const [all, results, kidPlaces, look] = await Promise.all([getCompetitionEntries(cid), getResults(primary.id), kidSeesPlaces(), getLook()]);
  const mine = all.filter((e) => e.swimmer_id === primary.id).sort((a, b) => a.event_no - b.event_no);
  if (!mine.length && !parent) notFound(); // the kid view only knows her own races

  const now = pragueNow();
  const today = now.slice(0, 10);
  const steps = raceSteps({
    nowLocal: now,
    registrationEnd: comp.registration_end,
    deregistrationEnd: comp.deregistration_end,
    startDate: comp.start_date,
    endDate: comp.end_date,
    drawn: comp.has_startlist || mine.some((e) => e.heat != null),
    hasAccepted: comp.has_accepted,
    hasResults: comp.has_results || mine.some((e) => e.status === "swum" || e.status === "dsq"),
  });

  // personal-best flags for her results at this meet
  const flags = pbFlags(results);
  const pbOf = (e: EntryRow): "pb" | "first" | "first_pool" | null => {
    const r = results.find((x) => x.competition_csps_id === cid && x.discipline === e.discipline && !x.is_split && x.time_ms === e.result_ms);
    const f = r ? (flags.get(r.id) ?? null) : null;
    if (f !== "first" || !r) return f;
    // first in this pool, but swum before in the other one
    return results.some((x) => x.discipline === r.discipline && x.pool_length !== r.pool_length && x.swim_date < r.swim_date) ? "first_pool" : "first";
  };
  const swumBefore = new Set(results.filter((r) => !r.is_dsq).map((r) => r.discipline));
  const replayOf = (e: EntryRow) => replayParamsFor(e, comp, results, { nick: NICK, cap: look.cap, birthYear: primary.birth_year, showField: parent || kidPlaces });
  const dive = diveMoment(
    { nick: NICK, today, results, pbIds: flags, meets: [{ id: cid, comp, list: mine }], birthYear: primary.birth_year, showPlaces: parent || kidPlaces },
    cid
  );
  const drawPending = steps.find((s) => s.key === "rozlosovani")?.state === "now" && mine.some((e) => e.status === "accepted");

  // program grouped by half-day
  const halfInfo = new Map((comp.halfdays ?? []).map((h) => [h.order, h]));
  const groups = new Map<number, EntryRow[]>();
  for (const e of mine) {
    const k = e.half_day ?? 0;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const multiDay = new Set(mine.map((e) => e.swim_date)).size > 1;
  const rel = relativeDay(comp.start_date, today);
  const docs = (comp.documents ?? []).filter((d) => parent || KID_DOCS.has(d.type));

  // parent: other tracked swimmers at the same meet
  const others = new Map<string, { name: string; entries: EntryRow[] }>();
  if (parent) {
    for (const e of all) {
      if (e.swimmer_id === primary.id) continue;
      if (!others.has(e.swimmer_id)) others.set(e.swimmer_id, { name: `${e.swimmer.first_name} ${e.swimmer.last_name}`, entries: [] });
      others.get(e.swimmer_id)!.entries.push(e);
    }
  }

  const order = new Map(mine.map((e, i) => [e.id, i]));
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-32 pt-4">
      <WaterHero>
        <div className="px-5 pt-4 pb-4">
          <Link href="/zavody" className="text-sm font-medium text-pool-100/80 hover:text-white">
            ← Závody
          </Link>
          <p className="mt-3 text-sm font-semibold text-pool-200">
            {rel} · {weekday(comp.start_date)} {shortDate(comp.start_date, true)}
            {comp.end_date && comp.end_date !== comp.start_date ? ` – ${shortDate(comp.end_date, true)}` : ""}
          </p>
          <h1 className="mt-1 text-[1.9rem] font-extrabold leading-[1.05]">{comp.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-pool-100/85">
            <span className="inline-flex items-center gap-1">
              <PinGlyph size={15} /> {comp.location}
            </span>
            <PoolBadge length={comp.pool_length} />
          </p>
          {mine.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm">
              <StatusRope tones={mine.map(toneOf)} />
              <p className="mt-1.5 text-sm font-semibold">{meetSummary(mine)}</p>
            </div>
          )}
        </div>
      </WaterHero>

      {dive && <MomentCard moment={{ ...dive, href: undefined }} look={look} />}

      <section className="animate-rise rounded-3xl border border-pool-100 bg-white px-3 pb-3 pt-4 shadow-[0_6px_18px_-12px_rgb(8_42_60/0.45)]">
        <RaceStepper steps={steps} />
        {drawPending && (
          <p className="mx-1 mt-3 rounded-2xl bg-pool-50 px-3 py-2 text-xs leading-relaxed text-pool-800 ring-1 ring-pool-100">
            Rozplavby a dráhy se teprve losují. Jakmile pořadatel zveřejní startovku, objeví se tady.
          </p>
        )}
      </section>

      {[...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([hd, list]) => {
          const info = halfInfo.get(hd);
          const times = halfDayTimes(info?.warmupMin ?? list[0].warmup_min, info?.startMin ?? list[0].start_min);
          return (
            <section key={hd}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="text-[1.35rem] font-extrabold text-pool-900">
                  {halfDayName(hd, info?.startMin ?? list[0].start_min)}
                  {multiDay && list[0].swim_date && <span className="ml-2 text-base font-semibold text-pool-900/45">{weekday(list[0].swim_date)} {shortDate(list[0].swim_date)}</span>}
                </h2>
                {times && <p className="nums text-sm font-medium text-pool-700">{times}</p>}
              </div>
              <div className="flex flex-col gap-3">
                {list.map((e) => (
                  <EventCard key={e.id} entry={e} birthYear={primary.birth_year} parent={parent} kidPlaces={kidPlaces} pb={pbOf(e)} delay={(order.get(e.id) ?? 0) * 60 + 60} firstEver={!swumBefore.has(e.discipline)} replay={replayOf(e)}
                    lineup={(parent || kidPlaces) && e.status === "drawn" && e.field?.pre ? e.field : null}
                    preview={parent || kidPlaces ? previewParamsFor(e, comp, { nick: NICK, cap: look.cap, birthYear: primary.birth_year }) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}

      {!mine.length && <p className="text-sm text-pool-900/50">Viki na tomhle závodě nestartuje.</p>}

      {docs.length > 0 && (
        <section>
          <SectionTitle>Dokumenty od pořadatele</SectionTitle>
          <div className="flex flex-col divide-y divide-pool-50 overflow-hidden rounded-3xl border border-pool-100 bg-white">
            {docs.map((d) => (
              <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-pool-800 hover:bg-pool-50">
                <DocGlyph size={18} className="text-pool-500" />
                {d.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {parent && others.size > 0 && (
        <section>
          <SectionTitle>Další sledované plavkyně</SectionTitle>
          <div className="flex flex-col gap-2">
            {[...others.values()].map((o) => (
              <div key={o.name} className="rounded-3xl border border-pool-100 bg-white p-4">
                <p className="font-bold text-pool-900">{o.name}</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {o.entries
                    .sort((a, b) => a.event_no - b.event_no)
                    .map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-pool-900/75">
                          <span className="text-pool-900/40">č. {e.event_no}</span> {eventName(e.discipline)}
                        </span>
                        {e.status === "swum" && e.result_ms != null ? (
                          <span className="nums font-bold text-pool-900">
                            {fmtTime(e.result_ms)}
                            {e.place_year ? <span className="ml-2 font-normal text-pool-900/50">{e.place_year}. v ročníku z {e.field_year}</span> : null}
                          </span>
                        ) : (
                          <StatusChip tone={toneOf(e)}>{statusLabel(e).label}</StatusChip>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <Nav role={role} />
    </main>
  );
}
