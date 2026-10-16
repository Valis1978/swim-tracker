import Link from "next/link";
import Nav from "@/components/Nav";
import { ChevronGlyph, MedalGlyph, SparkGlyph, StrokeGlyph } from "@/components/Glyphs";
import { SectionTitle, StatusChip, WaterHero } from "@/components/Pool";
import { MeetCard } from "@/components/Race";
import { requireRole } from "@/lib/auth";
import { statusLabel } from "@/lib/entries";
import { fmtTime } from "@/lib/format";
import { eventName, niceTitle, placeView, toneOf } from "@/lib/present";
import {
  getCompetitionsByIds,
  getPrimary,
  getRecentResults,
  getResults,
  getSwimmerEntries,
  kidSeesPlaces,
  type CompetitionRow,
  type EntryRow,
} from "@/lib/queries";
import { pbFlags } from "@/lib/records";
import { strokeOf } from "@/lib/strokes";
import { pragueToday, shortDate } from "@/lib/time";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ZavodyPage() {
  const role = await requireRole();
  const parent = role === "parent";
  const primary = await getPrimary();
  if (!primary) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-6 text-center text-pool-900/60">
        Zatím tu nikdo neplave.
        <Nav role={role} />
      </main>
    );
  }
  const today = pragueToday();
  const [entries, results, kidPlaces] = await Promise.all([getSwimmerEntries(primary.id), getResults(primary.id), kidSeesPlaces()]);

  // meets = everything with entries, plus older result-only meets
  const byMeet = new Map<number, EntryRow[]>();
  for (const e of entries) {
    if (!byMeet.has(e.competition_csps_id)) byMeet.set(e.competition_csps_id, []);
    byMeet.get(e.competition_csps_id)!.push(e);
  }
  const resultMeets = new Map<number, typeof results>();
  for (const r of results) {
    if (!r.competition_csps_id || byMeet.has(r.competition_csps_id) || r.is_split) continue;
    if (!resultMeets.has(r.competition_csps_id)) resultMeets.set(r.competition_csps_id, []);
    resultMeets.get(r.competition_csps_id)!.push(r);
  }
  const comps = await getCompetitionsByIds([...byMeet.keys()]);
  const upcoming = [...byMeet.entries()]
    .filter(([id]) => (comps.get(id)?.end_date ?? comps.get(id)?.start_date ?? "") >= today)
    .sort((a, b) => (comps.get(a[0])?.start_date ?? "").localeCompare(comps.get(b[0])?.start_date ?? ""));
  const flags = pbFlags(results);

  type Past = { id: number; date: string; title: string; location: string | null; comp: CompetitionRow | null; rows: { key: string; disc: string; ms: number | null; tone: ReturnType<typeof toneOf> | null; label: string | null; pb: "pb" | "first" | null; place: ReturnType<typeof placeView> }[] };
  const past: Past[] = [];
  for (const [id, list] of byMeet) {
    const c = comps.get(id) ?? null;
    if (!c || (c.end_date ?? c.start_date) >= today) continue;
    past.push({
      id,
      date: c.start_date,
      title: c.title,
      location: c.location,
      comp: c,
      rows: list
        .sort((a, b) => a.event_no - b.event_no)
        .map((e) => {
          const r = results.find((x) => x.competition_csps_id === id && x.discipline === e.discipline && !x.is_split && x.time_ms === e.result_ms);
          return {
            key: e.id,
            disc: e.discipline,
            ms: e.status === "swum" ? e.result_ms : null,
            tone: e.status === "swum" ? null : toneOf(e),
            label: e.status === "swum" ? null : statusLabel(e).label,
            pb: r ? (flags.get(r.id) ?? null) : null,
            place: placeView(e, primary.birth_year, { parent, kidPlaces }),
          };
        }),
    });
  }
  for (const [id, list] of resultMeets) {
    past.push({
      id,
      date: list[0].swim_date,
      title: niceTitle(list[0].competition_title ?? list[0].location ?? "Závod", list[0].location),
      location: list[0].location,
      comp: null,
      rows: list.map((r) => ({
        key: r.id,
        disc: r.discipline,
        ms: r.is_dsq ? null : r.time_ms,
        tone: r.is_dsq ? ("dsq" as const) : null,
        label: r.is_dsq ? "Diskvalifikace" : null,
        pb: flags.get(r.id) ?? null,
        place: null,
      })),
    });
  }
  past.sort((a, b) => b.date.localeCompare(a.date));

  // parent: the rest of the watchlist at upcoming meets
  let team: { comp: string; date: string; id: number; lines: { name: string; text: string }[] }[] = [];
  if (parent) {
    const { data } = await db()
      .from("swim_entries")
      .select("competition_csps_id,discipline,status,reserve_no,heat,lane,swim_date,swimmer:swim_swimmers(first_name,last_name,is_primary,active)")
      .gte("swim_date", today);
    const rows = (data ?? []) as unknown as { competition_csps_id: number; discipline: string; status: string; reserve_no: number | null; swim_date: string; swimmer: { first_name: string; last_name: string; is_primary: boolean; active: boolean } }[];
    const ids = [...new Set(rows.map((r) => r.competition_csps_id))];
    const teamComps = await getCompetitionsByIds(ids);
    team = ids
      .map((id) => {
        const lines = new Map<string, string[]>();
        for (const r of rows.filter((x) => x.competition_csps_id === id && !x.swimmer.is_primary && x.swimmer.active)) {
          const n = `${r.swimmer.first_name} ${r.swimmer.last_name}`;
          if (!lines.has(n)) lines.set(n, []);
          lines.get(n)!.push(`${eventName(r.discipline)}${r.status === "reserve" ? ` (N${r.reserve_no ?? ""})` : r.status === "not_accepted" || r.status === "withdrawn" ? " (ne)" : ""}`);
        }
        const c = teamComps.get(id);
        return { id, comp: c ? c.title : String(id), date: c?.start_date ?? "", lines: [...lines.entries()].map(([name, l]) => ({ name, text: l.join(", ") })) };
      })
      .filter((t) => t.lines.length)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const recent = parent ? await getRecentResults(60) : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-4">
      <WaterHero>
        <div className="px-5 pt-5 pb-4">
          <p className="text-sm font-semibold text-pool-200">{parent ? "Závody" : "Moje závody"}</p>
          <h1 className="mt-1 text-[2rem] font-extrabold leading-none">{upcoming.length ? (upcoming.length === 1 ? "Chystá se 1 závod" : `Chystají se ${upcoming.length} závody`) : "Teď je klid"}</h1>
          <p className="mt-2 text-sm text-pool-100/80">
            {past.length} {past.length === 1 ? "odplavaný závod" : past.length < 5 ? "odplavané závody" : "odplavaných závodů"}
          </p>
        </div>
      </WaterHero>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Nadcházející</SectionTitle>
          <div className="flex flex-col gap-3">
            {upcoming.map(([id, list]) => {
              const c = comps.get(id);
              return c ? <MeetCard key={id} comp={c} entries={list} href={`/zavod/${id}`} today={today} /> : null;
            })}
          </div>
        </section>
      )}

      {parent && team.length > 0 && (
        <section>
          <SectionTitle>Oddíl na startovkách</SectionTitle>
          <div className="flex flex-col gap-2">
            {team.map((t) => (
              <Link key={t.id} href={`/zavod/${t.id}`} className="rounded-3xl border border-pool-100 bg-white p-4 hover:bg-pool-50">
                <p className="font-bold text-pool-900">
                  {t.comp} <span className="font-normal text-pool-900/45">· {shortDate(t.date)}</span>
                </p>
                {t.lines.map((l) => (
                  <p key={l.name} className="mt-1 text-xs text-pool-900/65">
                    <b className="font-semibold text-pool-900/80">{l.name}:</b> {l.text}
                  </p>
                ))}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Odplavané</SectionTitle>
        <div className="flex flex-col gap-3">
          {past.map((m, i) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-pool-600">{shortDate(m.date, true)}</p>
                    <h3 className="text-lg font-extrabold leading-tight text-pool-900">{m.title}</h3>
                    {m.location && <p className="text-xs text-pool-900/50">{m.location}</p>}
                  </div>
                  {m.comp && <ChevronGlyph size={20} className="mt-1 shrink-0 text-pool-300" />}
                </div>
                <div className="mt-2 divide-y divide-pool-50 px-4 pb-2">
                  {m.rows.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-pool-900/80">
                        <StrokeGlyph stroke={strokeOf(r.disc)} size={20} />
                        {eventName(r.disc)}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.place?.medal && <MedalGlyph place={r.place.medal} size={20} />}
                        {r.place && (
                          <span className="text-xs text-pool-900/50">
                            {r.place.main.replace(/ v ročníku.*/, "")} {r.place.of}
                          </span>
                        )}
                        {r.pb === "pb" && <SparkGlyph size={15} className="text-gold" />}
                        {r.ms != null ? (
                          <span className="nums font-bold text-pool-900">{fmtTime(r.ms)}</span>
                        ) : (
                          r.tone && <StatusChip tone={r.tone}>{r.label}</StatusChip>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
            return m.comp ? (
              <Link key={m.id} href={`/zavod/${m.id}`} className="animate-rise block rounded-3xl border border-pool-100 bg-white hover:bg-pool-50/50" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                {body}
              </Link>
            ) : (
              <div key={m.id} className="animate-rise rounded-3xl border border-pool-100 bg-white" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                {body}
              </div>
            );
          })}
          {past.length === 0 && <p className="text-sm text-pool-900/50">Zatím žádný odplavaný závod.</p>}
        </div>
        {(parent || kidPlaces) && past.some((m) => m.rows.some((r) => r.place)) && (
          <p className="mt-2 text-xs text-pool-900/45">Pořadí = umístění mezi holkami stejného ročníku na daném závodě.</p>
        )}
      </section>

      {parent && recent.length > 0 && (
        <section>
          <SectionTitle>Nejnovější výsledky sledovaných</SectionTitle>
          <div className="divide-y divide-pool-50 overflow-hidden rounded-3xl border border-pool-100 bg-white">
            {recent.slice(0, 25).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate text-pool-900/75">
                  <span className="text-pool-900/40">{shortDate(r.swim_date)}</span> {r.swimmer.first_name} {r.swimmer.last_name} · {eventName(r.discipline)}
                  {r.pool_length === 50 ? " (50 m)" : ""}
                </span>
                <span className={`nums shrink-0 font-bold ${r.is_dsq ? "text-coral" : "text-pool-900"}`}>{fmtTime(r.time_ms)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <Nav role={role} />
    </main>
  );
}
