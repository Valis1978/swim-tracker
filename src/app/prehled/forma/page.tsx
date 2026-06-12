import Nav from "@/components/Nav";
import PrehledTabs from "@/components/PrehledTabs";
import { db, RankingSnapshot } from "@/lib/db";
import { getPrimary } from "@/lib/queries";
import { fmtTime, fmtDate, disciplineLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Entry { u: number; t: number }
type SnapshotWithEntries = RankingSnapshot & { entries: Entry[] | null };

// Trajectory of the field vs. the primary swimmer between the oldest and newest ranking snapshot.
export default async function FormaPage() {
  const primary = await getPrimary();
  const { data } = await db()
    .from("swim_rankings_snapshots")
    .select("*")
    .order("snapshot_date");
  const snaps = (data ?? []) as SnapshotWithEntries[];

  const byDisc = new Map<string, SnapshotWithEntries[]>();
  for (const s of snaps) {
    if (!byDisc.has(s.discipline)) byDisc.set(s.discipline, []);
    byDisc.get(s.discipline)!.push(s);
  }

  const order = ["50 P", "100 P", "50 K", "50 Z", "100 Z"];
  const cards = [...byDisc.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([disc, list]) => {
      const first = list[0];
      const last = list[list.length - 1];
      if (!first.entries || !last.entries || first.snapshot_date === last.snapshot_date) {
        return { disc, first, last, field: null as null | Record<string, number> };
      }
      const m0 = new Map(first.entries.map((e) => [e.u, e.t]));
      const m1 = new Map(last.entries.map((e) => [e.u, e.t]));
      const common = [...m0.keys()].filter((u) => m1.has(u));
      const deltas = common.map((u) => m0.get(u)! - m1.get(u)!); // >0 = improved (season best dropped)
      const improved = deltas.filter((d) => d > 0);
      const vikiId = primary?.csps_user_id ?? -1;
      const vikiDelta = m0.has(vikiId) && m1.has(vikiId) ? m0.get(vikiId)! - m1.get(vikiId)! : null;
      const fasterTrajectory = vikiDelta == null ? null : deltas.filter((d) => d > vikiDelta).length;
      return {
        disc, first, last,
        field: {
          common: common.length,
          improvedPct: common.length ? Math.round((100 * improved.length) / common.length) : 0,
          medianImp: improved.length ? improved.sort((a, b) => a - b)[Math.floor(improved.length / 2)] : 0,
          vikiDelta: vikiDelta ?? 0,
          hasViki: vikiDelta != null ? 1 : 0,
          fasterPct: fasterTrajectory != null && common.length ? Math.round((100 * fasterTrajectory) / common.length) : 0,
        },
      };
    });

  const firstDate = snaps[0]?.snapshot_date;
  const lastDate = snaps[snaps.length - 1]?.snapshot_date;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-pool-800">Forma vs. pole 📉</h1>
      <PrehledTabs />
      {firstDate && lastDate && firstDate !== lastDate ? (
        <p className="text-sm text-pool-900/50">
          Jak se mezi {fmtDate(firstDate)} a {fmtDate(lastDate)} pohnul žebříček ČR ročníku {snaps[0].birth_year} — celé pole vs. {primary?.first_name ?? "—"}. Žebříček počítá nejlepší výkon sezóny, takže „zlepšení" = posun sezónního maxima.
        </p>
      ) : (
        <p className="text-sm text-pool-900/50">
          Zatím je k dispozici jen jeden snímek žebříčku — srovnání trajektorií se objeví, jakmile denní synchronizace nasbírá další. První snímky: 31. 3. a {lastDate ? fmtDate(lastDate) : "—"}.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {cards.map(({ disc, first, last, field }) => (
          <div key={disc} className="rounded-2xl bg-white border border-pool-100 shadow-sm p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-pool-900">{disciplineLabel(disc)}</h2>
              <span className="text-xs text-pool-900/40">{fmtDate(first.snapshot_date)} → {fmtDate(last.snapshot_date)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-pool-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{primary?.first_name ?? "—"}</p>
                <p className="mt-1 text-pool-900">
                  {first.primary_rank ? `${first.primary_rank}.` : "—"} → <b>{last.primary_rank ? `${last.primary_rank}.` : "—"}</b>
                  {first.primary_rank && last.primary_rank && first.primary_rank !== last.primary_rank && (
                    <span className={`ml-1.5 text-xs font-bold ${last.primary_rank <= first.primary_rank ? "text-emerald-600" : "text-coral"}`}>
                      {last.primary_rank <= first.primary_rank ? `▲${first.primary_rank - last.primary_rank}` : `▼${last.primary_rank - first.primary_rank}`}
                    </span>
                  )}
                </p>
                <p className="text-xs text-pool-900/50 mt-0.5">
                  čas {fmtTime(first.primary_time_ms)} → {fmtTime(last.primary_time_ms)}
                  {field?.hasViki ? (field.vikiDelta > 0 ? ` (zlepšení o ${(field.vikiDelta / 1000).toFixed(2).replace(".", ",")} s)` : " (sezónní max beze změny)") : ""}
                </p>
              </div>
              <div className="rounded-xl bg-pool-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">Pole ({last.total_swimmers})</p>
                {field ? (
                  <>
                    <p className="mt-1 text-pool-900">
                      zlepšilo si <b>{field.improvedPct} %</b>
                      {field.medianImp > 0 && <span className="text-pool-900/60"> · typicky o {(field.medianImp / 1000).toFixed(2).replace(".", ",")} s</span>}
                    </p>
                    <p className="text-xs text-pool-900/50 mt-0.5">
                      rychlejší trajektorii než {primary?.first_name ?? "—"} mělo {field.fasterPct} % pole
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-pool-900/50 text-xs">čekám na druhý snímek žebříčku</p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-pool-900/40">
              medián pole {fmtTime(first.median_time_ms)} → {fmtTime(last.median_time_ms)} · nejlepší ČR {fmtTime(last.best_time_ms)}
            </p>
          </div>
        ))}
        {cards.length === 0 && <p className="text-sm text-pool-900/50">Žádné snímky žebříčku — spusť synchronizaci.</p>}
      </div>
      <Nav />
    </main>
  );
}
