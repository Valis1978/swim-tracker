import Nav from "@/components/Nav";
import { getUpcomingCompetitions, getRecentResults } from "@/lib/queries";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ZavodyPage() {
  const [upcoming, recent] = await Promise.all([getUpcomingCompetitions(), getRecentResults(200)]);

  // group past results by competition day
  const byDay = new Map<string, typeof recent>();
  for (const r of recent) {
    const key = `${r.swim_date}|${r.competition_title ?? r.location ?? ""}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-pool-800">Závody 🏁</h1>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Nadcházející</h2>
        {upcoming.length === 0 && (
          <p className="text-sm text-pool-900/50">Žádný naplánovaný závod v kalendáři.</p>
        )}
        <div className="flex flex-col gap-2">
          {upcoming.map((c) => (
            <div key={c.csps_id} className="rounded-2xl bg-medal/10 border border-medal/40 px-4 py-3">
              <p className="font-semibold text-pool-900">{c.title}</p>
              <p className="text-sm text-pool-900/60">{fmtDate(c.start_date)} · {c.location}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Odplavané</h2>
        <div className="flex flex-col gap-3">
          {days.map(([key, rows]) => {
            const [date] = key.split("|");
            return (
              <div key={key} className="rounded-2xl bg-white border border-pool-100 shadow-sm">
                <p className="px-4 pt-3 pb-1 text-sm font-semibold text-pool-900/70">
                  {rows[0].competition_title ?? rows[0].location} · {fmtDate(date)}
                </p>
                <div className="divide-y divide-pool-50">
                  {rows.map((r) => (
                    <div key={r.id} className="px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-pool-900/80">
                        {r.swimmer.first_name} {r.swimmer.last_name} · {disciplineLabel(r.discipline)}
                        {r.pool_length === 50 ? " (50m)" : ""}
                      </span>
                      <span className={`font-bold ${r.is_dsq ? "text-coral" : "text-pool-900"}`}>{fmtTime(r.time_ms)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {days.length === 0 && <p className="text-sm text-pool-900/50">Zatím nic — spusť synchronizaci.</p>}
        </div>
      </section>
      <Nav />
    </main>
  );
}
