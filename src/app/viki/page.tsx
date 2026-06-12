import Nav from "@/components/Nav";
import Confetti from "@/components/Confetti";
import Sparkline from "@/components/Sparkline";
import { getPrimary, getResults, getBadges, getUpcomingCompetitions, personalBests } from "@/lib/queries";
import { getRole } from "@/lib/auth";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VikiPage({ searchParams }: { searchParams: Promise<{ slavime?: string }> }) {
  const { slavime } = await searchParams;
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
  const pbs = personalBests(results, 25);
  const pbs50 = personalBests(results, 50);
  const raceDays = [...new Set(finals.map((r) => r.swim_date))].sort();
  const lastRaceDay = raceDays[raceDays.length - 1];
  const lastRace = finals.filter((r) => r.swim_date === lastRaceDay);
  const nextComp = upcoming.find((u) => u.entries && u.entries[String(primary.csps_user_id)]) ?? null;
  const nextEntries = nextComp?.entries?.[String(primary.csps_user_id)] ?? [];

  // "Moje cesta": first race result -> personal best per discipline (same pool as the PB)
  const journey: { disc: string; firstMs: number; bestMs: number; gain: number }[] = [];
  for (const [disc, best] of pbs) {
    const sameDisc = finals
      .filter((r) => r.discipline === disc && r.pool_length === best.pool_length)
      .sort((x, y) => x.swim_date.localeCompare(y.swim_date));
    if (sameDisc.length < 2) continue;
    const first = sameDisc[0];
    const gain = (first.time_ms - best.time_ms) / 1000;
    if (gain > 0.005) journey.push({ disc, firstMs: first.time_ms, bestMs: best.time_ms, gain });
  }
  journey.sort((x, y) => y.gain - x.gain);

  // fresh personal bests: newest race day results that equal the PB, within 3 days
  const freshPBs: { disc: string; timeMs: number; improvedBy: number | null }[] = [];
  if (lastRaceDay) {
    const ageDays = (Date.now() - +new Date(lastRaceDay)) / 86400_000;
    if (ageDays <= 3 || slavime) {
      for (const r of lastRace) {
        const best = pbs.get(r.discipline) ?? pbs50.get(r.discipline);
        if (!best || best.swim_date !== r.swim_date || best.time_ms !== r.time_ms) continue;
        const prev = finals
          .filter((x) => x.discipline === r.discipline && x.pool_length === r.pool_length && x.swim_date < r.swim_date)
          .reduce((m, x) => Math.min(m, x.time_ms), Infinity);
        if (prev === Infinity) continue; // first-ever swim, not a beaten PB
        freshPBs.push({ disc: r.discipline, timeMs: r.time_ms, improvedBy: (prev - r.time_ms) / 1000 });
      }
    }
  }
  const demo = Boolean(slavime) && freshPBs.length === 0;
  if (demo) {
    const top = [...pbs.entries()][0];
    if (top) freshPBs.push({ disc: top[0], timeMs: top[1].time_ms, improvedBy: 0.55 });
  }
  const celebrate = freshPBs.length > 0;

  // per-discipline 25m series for sparklines
  const series = new Map<string, number[]>();
  for (const r of finals.filter((x) => x.pool_length === 25).sort((a, b) => a.swim_date.localeCompare(b.swim_date))) {
    if (!series.has(r.discipline)) series.set(r.discipline, []);
    series.get(r.discipline)!.push(r.time_ms);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      {celebrate && <Confetti />}
      {celebrate && (
        <section className="rounded-3xl bg-gradient-to-br from-medal to-coral text-white p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">{demo ? "ukázka oslavy" : "to je ono!"}</p>
          <h2 className="text-2xl font-bold mt-1">🎉 NOVÝ OSOBÁK!</h2>
          {freshPBs.map((p) => (
            <p key={p.disc} className="mt-1 text-white/95 font-semibold">
              {disciplineLabel(p.disc)} — {fmtTime(p.timeMs)}
              {p.improvedBy != null && p.improvedBy > 0 && (
                <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-sm">o {p.improvedBy.toFixed(2).replace(".", ",")} s rychleji!</span>
              )}
            </p>
          ))}
        </section>
      )}
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
            {nextEntries.length > 0 && (
              <p className="text-xs text-pool-900/60 mt-1">
                poplave: {nextEntries.filter((e) => e.status !== "reserve").map((e) => disciplineLabel(e.disc)).join(", ") || "—"}
              </p>
            )}
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
                <p className="text-3xl font-bold text-pool-900 mt-0.5">
                  {fmtTime(r.time_ms)}
                  {r.points != null && <span className="ml-2 text-sm font-semibold text-pool-400">{r.points} b.</span>}
                </p>
                <p className="text-xs text-pool-900/50 mt-0.5">{fmtDate(r.swim_date)} · {r.location}</p>
              </div>
              {(series.get(disc)?.length ?? 0) >= 2 && <Sparkline values={series.get(disc)!} />}
            </div>
          ))}
          {pbs.size === 0 && <p className="text-pool-900/50 text-sm">Zatím žádné časy — po prvním závodě se tu objeví.</p>}
        </div>
      </section>

      {pbs50.size > 0 && (
        <section>
          <h2 className="text-xl font-bold text-pool-800 mb-3">Dlouhý bazén (50m)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...pbs50.entries()].map(([disc, r]) => (
              <div key={disc} className="rounded-2xl bg-white p-4 shadow-sm border border-pool-100">
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{disciplineLabel(disc)}</p>
                <p className="text-2xl font-bold text-pool-900 mt-0.5">
                  {fmtTime(r.time_ms)}
                  {r.points != null && <span className="ml-2 text-sm font-semibold text-pool-400">{r.points} b.</span>}
                </p>
                <p className="text-xs text-pool-900/50 mt-0.5">{fmtDate(r.swim_date)} · {r.location}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {journey.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-pool-800 mb-3">Moje cesta 🛤️</h2>
          <div className="flex flex-col gap-2">
            {journey.map((j) => (
              <div key={j.disc} className="rounded-2xl bg-white border border-pool-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{disciplineLabel(j.disc)}</p>
                  <p className="text-sm text-pool-900/70 mt-0.5">
                    {fmtTime(j.firstMs)} <span className="text-pool-400">→</span> <b className="text-pool-900">{fmtTime(j.bestMs)}</b>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold px-3 py-1.5">
                  −{j.gain.toFixed(1).replace(".", ",")} s {j.gain >= 5 ? "🚀" : j.gain >= 2 ? "⚡" : "💪"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-pool-900/40 mt-2">Od tvého úplně prvního startu k osobáku.</p>
        </section>
      )}

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
