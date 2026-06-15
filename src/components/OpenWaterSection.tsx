import { OwResult } from "@/lib/queries";
import { fmtTime, fmtDate } from "@/lib/format";

// Open-water (dálkové plavání) results — distance-based, placing by finish order.
export default function OpenWaterSection({ results, heading = "Dálkové plavání 🌊", kid = false }: {
  results: OwResult[];
  heading?: string;
  kid?: boolean;
}) {
  if (results.length === 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <section>
      <h2 className="text-xl font-bold text-pool-800 mb-3">{heading}</h2>
      <div className="flex flex-col gap-2">
        {results.map((r) => {
          const upcoming = r.status !== "result";
          const awaiting = upcoming && r.swim_date != null && r.swim_date <= todayStr;
          return (
            <div key={r.id} className="rounded-2xl bg-white border border-pool-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-pool-500">{r.distance_label}</p>
                <p className="text-sm text-pool-900/70 mt-0.5 truncate">
                  {r.competition_title ?? r.location}
                  {r.swim_date ? ` · ${fmtDate(r.swim_date)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                {upcoming ? (
                  <span className="rounded-full bg-pool-50 border border-pool-200 text-pool-700 text-xs font-semibold px-2.5 py-1">
                    {awaiting ? "čeká na výsledky" : r.status === "reserve" ? "pod čarou" : "přihlášena"}
                  </span>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-pool-900 leading-none">{fmtTime(r.time_ms)}</p>
                    {r.place_rank != null && (
                      <p className="text-xs font-semibold text-medal mt-1">
                        {kid ? "" : "umístění "}{r.place_rank}.{r.field_n ? ` z ${r.field_n}` : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {kid && <p className="text-xs text-pool-900/40 mt-2">Plavání v otevřené vodě — jiný svět než bazén. 🌊</p>}
    </section>
  );
}
