import Nav from "@/components/Nav";
import Sparkline from "@/components/Sparkline";
import { getPrimary, getResults, getBadges, getUpcomingCompetitions, personalBests } from "@/lib/queries";
import { getRole } from "@/lib/auth";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VikiPage() {
  const role = (await getRole()) ?? "kid";
  const primary = await getPrimary();
  if (!primary) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-8 text-center text-pool-900/60">
        Zatím tu nikdo neplave — přidej plavce v Nastavení a spusť synchronizaci.
        <Nav role={role} />
      </main>
    );
  }
  const [results, badges, upcoming] = await Promise.all([
    getResults(primary.id),
    getBadges(primary.id),
    getUpcomingCompetitions(),
  ]);
  const finals = results.filter((r) => !r.is_split && !r.is_dsq);
  const pbs = personalBests(results);
  const raceDays = [...new Set(finals.map((r) => r.swim_date))].sort();
  const lastRaceDay = raceDays[raceDays.length - 1];
  const lastRace = finals.filter((r) => r.swim_date === lastRaceDay);
  const nextComp = upcoming[0];

  // per-discipline 25m series for sparklines
  const series = new Map<string, number[]>();
  for (const r of finals.filter((x) => x.pool_length === 25).sort((a, b) => a.swim_date.localeCompare(b.swim_date))) {
    if (!series.has(r.discipline)) series.set(r.discipline, []);
    series.get(r.discipline)!.push(r.time_ms);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <header className="rounded-3xl bg-gradient-to-br from-pool-500 to-pool-700 text-white p-6 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 text-8xl opacity-20 float">🌊</div>
        <p className="text-pool-100 text-sm font-medium">ahoj, tady plave</p>
        <h1 className="text-4xl font-bold mt-1">{primary.first_name} 🏊‍♀️</h1>
        <p className="mt-2 text-pool-100 text-sm">
          {primary.club_abbrev === "OSPHo" ? "OSP Hodonín" : (primary.club_abbrev ?? primary.club_name ?? "")} · {raceDays.length}{" "}
          {raceDays.length === 1 ? "závod" : raceDays.length < 5 ? "závody" : "závodů"}
        </p>
      </header>

      {nextComp && (
        <section className="rounded-3xl bg-medal/15 border-2 border-medal/40 p-5 flex items-center gap-4">
          <div className="text-4xl">🏁</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-pool-800/60">příští závod</p>
            <p className="font-bold text-pool-900">{nextComp.title}</p>
            <p className="text-sm text-pool-900/70">
              {fmtDate(nextComp.start_date)} · {nextComp.location}
            </p>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold text-pool-800 mb-3">Moje nejlepší časy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...pbs.entries()].map(([disc, r]) => (
            <div key={disc} className="rounded-2xl bg-white p-4 shadow-sm border border-pool-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{disciplineLabel(disc)}</p>
                <p className="text-3xl font-bold text-pool-900 mt-0.5">{fmtTime(r.time_ms)}</p>
                <p className="text-xs text-pool-900/50 mt-0.5">{fmtDate(r.swim_date)} · {r.location}</p>
              </div>
              {(series.get(disc)?.length ?? 0) >= 2 && <Sparkline values={series.get(disc)!} />}
            </div>
          ))}
          {pbs.size === 0 && <p className="text-pool-900/50 text-sm">Zatím žádné časy — po prvním závodě se tu objeví.</p>}
        </div>
      </section>

      {badges.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-pool-800 mb-3">Odznaky</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {badges.map((b) => (
              <div key={b.badge_key} className="rounded-2xl bg-white border border-pool-100 shadow-sm p-3 flex flex-col items-center text-center gap-1">
                <span className="text-3xl">{b.emoji}</span>
                <span className="text-[11px] font-semibold text-pool-900/70 leading-tight">{b.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {lastRace.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-pool-800 mb-3">Poslední závod</h2>
          <div className="rounded-2xl bg-white border border-pool-100 shadow-sm divide-y divide-pool-50">
            <p className="px-4 pt-3 pb-1 text-sm font-semibold text-pool-900/60">
              {lastRace[0].competition_title ?? lastRace[0].location} · {fmtDate(lastRaceDay)}
            </p>
            {lastRace.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium text-pool-900/80">{disciplineLabel(r.discipline)}</span>
                <span className="font-bold text-pool-900">{fmtTime(r.time_ms)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-pool-900/40 pb-2">
        Každý start se počítá. Plav si svoje. 💙
      </p>
      <Nav role={role} />
    </main>
  );
}
