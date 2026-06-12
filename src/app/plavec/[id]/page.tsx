import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Sparkline from "@/components/Sparkline";
import { db, Swimmer } from "@/lib/db";
import { getResults, personalBests } from "@/lib/queries";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlavecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await db().from("swim_swimmers").select("*").eq("id", id).maybeSingle();
  const swimmer = data as Swimmer | null;
  if (!swimmer) notFound();

  const results = await getResults(swimmer.id);
  const finals = results.filter((r) => !r.is_split && !r.is_dsq);
  const pbs = personalBests(results);
  const raceDays = [...new Set(finals.map((r) => r.swim_date))].sort();

  const series = new Map<string, number[]>();
  for (const r of finals.filter((x) => x.pool_length === 25).sort((a, b) => a.swim_date.localeCompare(b.swim_date))) {
    if (!series.has(r.discipline)) series.set(r.discipline, []);
    series.get(r.discipline)!.push(r.time_ms);
  }

  // race history newest first
  const byDay = new Map<string, typeof results>();
  for (const r of results.filter((x) => !x.is_split)) {
    if (!byDay.has(r.swim_date)) byDay.set(r.swim_date, []);
    byDay.get(r.swim_date)!.push(r);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <div>
        <Link href="/prehled" className="text-sm text-pool-600 font-semibold">← Přehled</Link>
        <h1 className="text-3xl font-bold text-pool-800 mt-2">
          {swimmer.first_name} {swimmer.last_name} {swimmer.is_primary && "⭐"}
        </h1>
        <p className="text-sm text-pool-900/50 mt-1">
          {swimmer.club_name ?? swimmer.club_abbrev} · ročník {swimmer.birth_year ?? "?"} · {raceDays.length} závodních dní
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Osobní rekordy (25m)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...pbs.entries()].map(([disc, r]) => (
            <div key={disc} className="rounded-2xl bg-white p-4 shadow-sm border border-pool-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{disciplineLabel(disc)}</p>
                <p className="text-2xl font-bold text-pool-900 mt-0.5">{fmtTime(r.time_ms)}</p>
                <p className="text-xs text-pool-900/50 mt-0.5">{fmtDate(r.swim_date)}</p>
              </div>
              {(series.get(disc)?.length ?? 0) >= 2 && <Sparkline values={series.get(disc)!} width={90} />}
            </div>
          ))}
          {pbs.size === 0 && <p className="text-sm text-pool-900/50">Žádné výsledky v 25m bazénu.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-pool-800 mb-2">Historie závodů</h2>
        <div className="flex flex-col gap-3">
          {days.map(([date, rows]) => (
            <div key={date} className="rounded-2xl bg-white border border-pool-100 shadow-sm">
              <p className="px-4 pt-3 pb-1 text-sm font-semibold text-pool-900/70">
                {rows[0].competition_title ?? rows[0].location} · {fmtDate(date)}
              </p>
              <div className="divide-y divide-pool-50">
                {rows.map((r) => (
                  <div key={r.id} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span className="text-pool-900/80">
                      {disciplineLabel(r.discipline)}
                      {r.pool_length === 50 ? " (50m)" : ""}
                    </span>
                    <span className={`font-bold ${r.is_dsq ? "text-coral" : "text-pool-900"}`}>{fmtTime(r.time_ms)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Nav />
    </main>
  );
}
