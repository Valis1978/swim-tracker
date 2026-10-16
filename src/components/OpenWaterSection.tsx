import { OwResult } from "@/lib/queries";
import { fmtTime, fmtDate } from "@/lib/format";
import { MedalGlyph, OpenWaterGlyph } from "@/components/Glyphs";
import { SectionTitle, StatusChip } from "@/components/Pool";

// Open-water (dálkové plavání) results — distance-based, placing by finish order.
export default function OpenWaterSection({ results, heading = "Dálkové plavání", kid = false, showPlace = !kid }: {
  results: OwResult[];
  heading?: string;
  kid?: boolean;
  showPlace?: boolean;
}) {
  if (results.length === 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <section>
      <SectionTitle>{heading}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {results.map((r, i) => {
          const upcoming = r.status !== "result";
          const awaiting = upcoming && r.swim_date != null && r.swim_date <= todayStr;
          const stale = awaiting && r.swim_date != null && Date.parse(todayStr) - Date.parse(r.swim_date) > 7 * 86400_000;
          const medal = !upcoming && showPlace && r.place_rank != null && r.place_rank <= 3 ? (r.place_rank as 1 | 2 | 3) : null;
          return (
            <div
              key={r.id}
              className="animate-rise flex items-center justify-between gap-3 rounded-3xl border border-pool-100 bg-white px-4 py-3 shadow-[0_6px_18px_-12px_rgb(8_42_60/0.45)]"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pool-50 text-pool-600 ring-1 ring-pool-100">
                  <OpenWaterGlyph size={24} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-pool-900">{r.distance_label}</p>
                  <p className="truncate text-xs text-pool-900/55">
                    {r.competition_title ?? r.location}
                    {r.swim_date ? ` · ${fmtDate(r.swim_date)}` : ""}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {upcoming ? (
                  <StatusChip tone={stale ? "off" : awaiting ? "wait" : r.status === "reserve" ? "reserve" : "ok"}>
                    {stale ? "bez výsledku" : awaiting ? "čeká na výsledky" : r.status === "reserve" ? "náhradnice" : "přihlášená"}
                  </StatusChip>
                ) : (
                  <>
                    <p className="display nums text-2xl font-extrabold leading-none text-pool-900">{fmtTime(r.time_ms)}</p>
                    {showPlace && r.place_rank != null ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-pool-800">
                        {medal && <MedalGlyph place={medal} size={18} />}
                        {r.place_rank}. místo{r.field_n ? ` z ${r.field_n}` : ""}
                      </p>
                    ) : (
                      kid && <p className="mt-1 text-xs font-semibold text-pool-500">dokončeno</p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {kid && <p className="mt-2 text-xs text-pool-900/45">Plavání v otevřené vodě, úplně jiný svět než bazén.</p>}
    </section>
  );
}
