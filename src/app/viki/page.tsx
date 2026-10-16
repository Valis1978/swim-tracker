import Link from "next/link";
import Nav from "@/components/Nav";
import MomentCard from "@/components/anim/MomentCard";
import CapPicker from "@/components/anim/CapPicker";
import { ChevronGlyph, MedalGlyph, SparkGlyph, StrokeGlyph } from "@/components/Glyphs";
import { SectionTitle, StatusChip, ToneDot, WaterHero } from "@/components/Pool";
import { MeetCard } from "@/components/Race";
import { requireRole } from "@/lib/auth";
import { changeText, type Tone } from "@/lib/entries";
import { fmtTime } from "@/lib/format";
import { eventName, placeView, toneOf } from "@/lib/present";
import { getBadges, getCompetitionsByIds, getLook, getPrimary, getResults, getSwimmerEntries, kidSeesPlaces, type EntryRow } from "@/lib/queries";
import { computeRecords, pbFlags } from "@/lib/records";
import { pickHomeMoment, type Moment } from "@/lib/moments";
import { STROKE_META, strokeOf } from "@/lib/strokes";
import { addDays, pragueToday, relativeDay, shortDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const NICK = "Viki";

export default async function VikiPage({ searchParams }: { searchParams: Promise<{ slavime?: string }> }) {
  const { slavime } = await searchParams;
  const role = await requireRole();
  const parent = role === "parent";
  const primary = await getPrimary();
  if (!primary) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-8 text-center text-pool-900/60">
        Zatím tu nikdo neplave — přidej plavce v Nastavení a spusť synchronizaci.
        <Nav role={role} />
      </main>
    );
  }
  const today = pragueToday();
  const [results, badges, entries, kidPlaces, look] = await Promise.all([getResults(primary.id), getBadges(primary.id), getSwimmerEntries(primary.id), kidSeesPlaces(), getLook()]);

  // ---- meets
  const byMeet = new Map<number, EntryRow[]>();
  for (const e of entries) {
    if (!byMeet.has(e.competition_csps_id)) byMeet.set(e.competition_csps_id, []);
    byMeet.get(e.competition_csps_id)!.push(e);
  }
  const comps = await getCompetitionsByIds([...byMeet.keys()]);
  const meets = [...byMeet.entries()]
    .map(([id, list]) => ({ id, comp: comps.get(id)!, list: list.sort((a, b) => a.event_no - b.event_no) }))
    .filter((m) => m.comp);
  const upcoming = meets.filter((m) => (m.comp.end_date ?? m.comp.start_date) >= today).sort((a, b) => a.comp.start_date.localeCompare(b.comp.start_date));
  const next = upcoming[0] ?? null;
  const lastMeet = meets
    .filter((m) => m.comp.start_date <= today && m.list.some((e) => e.status === "swum" || e.status === "dsq"))
    .sort((a, b) => b.comp.start_date.localeCompare(a.comp.start_date))[0];

  // ---- what's new: entry changes of the last three weeks, bursts collapsed per meet
  const cutoff = addDays(today, -21);
  type News = { at: string; text: string; tone: Tone; href: string };
  const news: News[] = [];
  for (const m of meets) {
    const bursts = new Map<string, { status: string; items: EntryRow[] }>();
    for (const e of m.list) {
      for (const h of e.history) {
        if (h.at.slice(0, 10) < cutoff || !h.from) continue;
        const k = `${h.at.slice(0, 16)}|${h.to.status}`;
        if (!bursts.has(k)) bursts.set(k, { status: h.to.status, items: [] });
        bursts.get(k)!.items.push({ ...e, ...h.to, history: [h] });
      }
    }
    for (const [k, b] of bursts) {
      const at = k.slice(0, 16);
      const href = `/zavod/${m.id}`;
      if (b.items.length > 1 && (b.status === "accepted" || b.status === "drawn")) {
        const all = b.items.length === m.list.length;
        news.push({
          at,
          tone: b.status === "accepted" ? "ok" : "drawn",
          text:
            b.status === "accepted"
              ? `${m.comp.title}: po odhláškách ${all ? `potvrzeno všech ${b.items.length} tratí` : `potvrzeno ${b.items.length} tratí`}`
              : `${m.comp.title}: rozlosováno — mrkni na rozplavby a dráhy`,
          href,
        });
        continue;
      }
      for (const e of b.items) {
        const h = e.history[0];
        const t = changeText(eventName(e.discipline), h.from, h.to, fmtTime);
        if (t) news.push({ at, tone: toneOf(e), text: `${m.comp.title} · ${t}`, href });
      }
    }
  }
  news.sort((a, b) => b.at.localeCompare(a.at));

  // ---- personal bests
  const flags = pbFlags(results);
  const records = [...computeRecords(results, 25), ...computeRecords(results, 50)];
  let moment: Moment | null = pickHomeMoment({ nick: NICK, today, results, pbIds: flags, meets, birthYear: primary.birth_year, showPlaces: parent || kidPlaces });
  // ?slavime=1 shows the personal-best animation on demand
  if (slavime && moment?.kind !== "pb" && records[0]) {
    const r = records[0];
    moment = {
      kind: "pb",
      key: "pb:demo",
      title: "Ukázka oslavy",
      text: `Takhle appka slaví nový osobák. Tvůj rekord: ${eventName(r.discipline)} za ${fmtTime(r.best.time_ms)}.`,
      params: { label: `${r.distance} m · ${NICK.toUpperCase()}`, time: fmtTime(r.best.time_ms), banner: "NOVÝ OSOBÁK" },
    };
  }
  const topRecords = [...records].sort((a, b) => (b.best.points ?? 0) - (a.best.points ?? 0)).slice(0, 4);

  // "Moje cesta": first race -> record (25 m), always positive
  const journey = computeRecords(results, 25)
    .filter((r) => r.gainMs != null && r.gainMs > 5)
    .sort((a, b) => (b.gainMs ?? 0) - (a.gainMs ?? 0))
    .slice(0, 5);

  const club = primary.club_abbrev === "OSPHo" ? "OSP Hodonín" : (primary.club_abbrev ?? primary.club_name ?? "");
  const raceCount = new Set(results.filter((r) => !r.is_split).map((r) => `${r.swim_date}|${r.competition_csps_id}`)).size;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-4">

      <WaterHero>
        <div className="px-5 pt-5 pb-4">
          <p className="text-sm font-semibold text-pool-200">
            {club}
            {raceCount ? ` · ${raceCount} ${raceCount === 1 ? "závod" : raceCount < 5 ? "závody" : "závodů"}` : ""}
          </p>
          <h1 className="mt-1 text-[2.6rem] font-extrabold leading-none">Ahoj, {NICK}!</h1>
          {next ? (
            <Link href={`/zavod/${next.id}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/20">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-pool-200">
                  {relativeDay(next.comp.start_date, today) === "dnes" ? "dnes závodíš" : `příští závod ${relativeDay(next.comp.start_date, today)}`}
                </span>
                <span className="block truncate text-lg font-bold">{next.comp.title}</span>
              </span>
              <ChevronGlyph size={22} className="shrink-0 text-pool-200" />
            </Link>
          ) : (
            <p className="mt-3 text-pool-100/80">Žádný závod v kalendáři. Užij si trénink!</p>
          )}
        </div>
      </WaterHero>

      {moment && <MomentCard moment={moment} look={look} />}

      {next && (
        <section>
          <SectionTitle>Příští závod</SectionTitle>
          <MeetCard comp={next.comp} entries={next.list} href={`/zavod/${next.id}`} today={today} />
        </section>
      )}

      {news.length > 0 && (
        <section>
          <SectionTitle>Co je nového</SectionTitle>
          <ul className="flex flex-col divide-y divide-pool-50 overflow-hidden rounded-3xl border border-pool-100 bg-white">
            {news.slice(0, 5).map((n, i) => (
              <li key={i}>
                <Link href={n.href} className="flex items-start gap-3 px-4 py-3 hover:bg-pool-50">
                  <ToneDot tone={n.tone} className="mt-1.5" />
                  <span className="min-w-0 flex-1 text-sm text-pool-900/80">{n.text}</span>
                  <span className="shrink-0 text-xs text-pool-900/40">{shortDate(n.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topRecords.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link href="/rekordy" className="text-sm font-semibold text-pool-600 hover:text-pool-800">
                Všechny rekordy →
              </Link>
            }
          >
            Moje rekordy
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {topRecords.map((r, i) => (
              <Link
                key={`${r.discipline}-${r.best.pool_length}`}
                href={`/rekordy?bazen=${r.best.pool_length}`}
                className="animate-rise relative overflow-hidden rounded-3xl border border-pool-100 bg-white p-4 hover:-translate-y-0.5 transition"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: STROKE_META[r.stroke].color }} aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: STROKE_META[r.stroke].color }}>
                  <StrokeGlyph stroke={r.stroke} size={18} />
                  {eventName(r.discipline)}
                </div>
                <p className="display nums mt-1.5 text-[1.7rem] font-extrabold leading-none text-pool-900">{fmtTime(r.best.time_ms)}</p>
                <p className="mt-1 text-[11px] text-pool-900/45">
                  {r.best.pool_length} m bazén{r.best.points != null ? ` · ${r.best.points} b.` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {lastMeet && (
        <section>
          <SectionTitle>Poslední závod</SectionTitle>
          <Link href={`/zavod/${lastMeet.id}`} className="block overflow-hidden rounded-3xl border border-pool-100 bg-white hover:bg-pool-50/40">
            <div className="flex items-start justify-between gap-3 px-4 pt-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-pool-600">{shortDate(lastMeet.comp.start_date, true)}</p>
                <h3 className="text-lg font-extrabold leading-tight text-pool-900">{lastMeet.comp.title}</h3>
              </div>
              <ChevronGlyph size={20} className="mt-1 shrink-0 text-pool-300" />
            </div>
            <div className="mt-2 divide-y divide-pool-50 px-4 pb-2">
              {lastMeet.list
                .filter((e) => e.status === "swum" || e.status === "dsq")
                .map((e) => {
                  const r = results.find((x) => x.competition_csps_id === lastMeet.id && x.discipline === e.discipline && !x.is_split && x.time_ms === e.result_ms);
                  const pl = placeView(e, primary.birth_year, { parent, kidPlaces });
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-pool-900/80">
                        <StrokeGlyph stroke={strokeOf(e.discipline)} size={20} />
                        {eventName(e.discipline)}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {pl?.medal && <MedalGlyph place={pl.medal} size={20} />}
                        {pl && (
                          <span className="text-xs text-pool-900/50">
                            {pl.main.replace(/ v ročníku.*/, "")} {pl.of}
                          </span>
                        )}
                        {r && flags.get(r.id) === "pb" && <SparkGlyph size={15} className="text-gold" />}
                        {e.status === "swum" && e.result_ms != null ? (
                          <span className="nums font-bold text-pool-900">{fmtTime(e.result_ms)}</span>
                        ) : (
                          <StatusChip tone="dsq">DSQ</StatusChip>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Link>
        </section>
      )}

      {journey.length > 0 && (
        <section>
          <SectionTitle>Moje cesta</SectionTitle>
          <div className="flex flex-col gap-2">
            {journey.map((j) => (
              <div key={j.discipline} className="flex items-center justify-between gap-3 rounded-3xl border border-pool-100 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StrokeGlyph stroke={j.stroke} size={24} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-pool-900">{eventName(j.discipline)}</p>
                    <p className="nums text-xs text-pool-900/55">
                      {fmtTime(j.firstMs)} <span className="text-pool-300">→</span> <b className="text-pool-900">{fmtTime(j.best.time_ms)}</b>
                    </p>
                  </div>
                </div>
                <span className="nums shrink-0 rounded-full bg-[#e3f8ef] px-3 py-1.5 text-sm font-bold text-[#07704b] ring-1 ring-[#99dfbf]">
                  −{((j.gainMs ?? 0) / 1000).toFixed(1).replace(".", ",")} s
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-pool-900/45">Od tvého úplně prvního startu k rekordu (krátký bazén).</p>
        </section>
      )}

      <CapPicker initial={look.cap} />

      {badges.length > 0 && (
        <section>
          <SectionTitle>Odznaky</SectionTitle>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {badges.map((b, i) => (
              <div key={b.badge_key} className="animate-rise flex flex-col items-center gap-1.5 rounded-3xl border border-pool-100 bg-white p-3 text-center" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-pool-50 to-pool-100 text-2xl ring-2 ring-white shadow-inner">{b.emoji}</span>
                <span className="text-[11px] font-semibold leading-tight text-pool-900/70">{b.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="pb-2 text-center text-xs text-pool-900/40">Každý start se počítá. Plav si svoje.</p>
      <Nav role={role} />
    </main>
  );
}
