import Nav from "@/components/Nav";
import { getPrimary, getLatestSnapshots, getPreviousSnapshots, getSwimmers, getRecentResults } from "@/lib/queries";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrehledPage() {
  const [primary, snapshots, swimmers, recent] = await Promise.all([
    getPrimary(),
    getLatestSnapshots(),
    getSwimmers(),
    getRecentResults(30),
  ]);
  const prev = snapshots.length ? await getPreviousSnapshots(snapshots[0].snapshot_date) : [];
  const prevByDisc = new Map(prev.map((s) => [s.discipline, s]));
  const order = ["50 P", "100 P", "50 K", "50 Z", "100 Z"];
  const sorted = [...snapshots].sort((a, b) => order.indexOf(a.discipline) - order.indexOf(b.discipline));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-pool-800">Přehled pro tátu 📊</h1>
        {snapshots[0] && (
          <p className="text-sm text-pool-900/50 mt-1">
            Žebříček ČR ročníku {snapshots[0].birth_year}, 25m bazén · stav k {fmtDate(snapshots[0].snapshot_date)}
          </p>
        )}
      </header>

      <section className="rounded-2xl bg-white border border-pool-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-pool-900/50 border-b border-pool-100">
              <th className="px-4 py-3">Disciplína</th>
              <th className="px-2 py-3 text-right">{primary?.first_name ?? "—"}</th>
              <th className="px-2 py-3 text-right">Pořadí</th>
              <th className="px-2 py-3 text-right">Percentil</th>
              <th className="px-2 py-3 text-right">Medián ČR</th>
              <th className="px-4 py-3 text-right">Nejlepší ČR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pool-50">
            {sorted.map((s) => {
              const p = prevByDisc.get(s.discipline);
              const rankDelta = p?.primary_rank && s.primary_rank ? s.primary_rank - p.primary_rank : null;
              const pct = s.primary_rank ? Math.round((100 * (s.total_swimmers - s.primary_rank)) / s.total_swimmers) : null;
              return (
                <tr key={s.discipline}>
                  <td className="px-4 py-3 font-semibold text-pool-900">{disciplineLabel(s.discipline)}</td>
                  <td className="px-2 py-3 text-right font-bold">{fmtTime(s.primary_time_ms)}</td>
                  <td className="px-2 py-3 text-right">
                    {s.primary_rank ? `${s.primary_rank}. / ${s.total_swimmers}` : "—"}
                    {rankDelta != null && rankDelta !== 0 && (
                      <span className={`ml-1 text-xs font-bold ${rankDelta < 0 ? "text-emerald-600" : "text-coral"}`}>
                        {rankDelta < 0 ? `▲${-rankDelta}` : `▼${rankDelta}`}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">{pct != null ? `lepší než ${pct} %` : "—"}</td>
                  <td className="px-2 py-3 text-right text-pool-900/70">{fmtTime(s.median_time_ms)}</td>
                  <td className="px-4 py-3 text-right text-pool-900/70">{fmtTime(s.best_time_ms)}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-pool-900/50">Žebříčky se naplní po první synchronizaci.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Sledovaní plavci ({swimmers.length})</h2>
        <div className="rounded-2xl bg-white border border-pool-100 shadow-sm divide-y divide-pool-50">
          {swimmers.map((s) => (
            <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span className="font-medium text-pool-900">
                {s.is_primary && "⭐ "}
                {s.first_name} {s.last_name}
              </span>
              <span className="text-pool-900/50">{s.club_abbrev ?? s.club_name ?? ""}{s.birth_year ? ` · ${s.birth_year}` : ""}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Poslední výsledky</h2>
        <div className="rounded-2xl bg-white border border-pool-100 shadow-sm divide-y divide-pool-50">
          {recent.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-pool-900 truncate">
                  {r.swimmer.first_name} {r.swimmer.last_name} · {disciplineLabel(r.discipline)}
                  {r.pool_length === 50 ? " (50m)" : ""}
                </p>
                <p className="text-xs text-pool-900/50 truncate">{fmtDate(r.swim_date)} · {r.competition_title ?? r.location}</p>
              </div>
              <span className={`font-bold shrink-0 ${r.is_dsq ? "text-coral" : "text-pool-900"}`}>{fmtTime(r.time_ms)}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="px-4 py-6 text-center text-pool-900/50 text-sm">Zatím žádné výsledky.</p>}
        </div>
      </section>
      <Nav />
    </main>
  );
}
