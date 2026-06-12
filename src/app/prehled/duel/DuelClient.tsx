"use client";

import { useEffect, useMemo, useState } from "react";

interface RaceResult { disc: string; time: number; isDsq: boolean }
interface RaceDay { date: string; title: string; pool: number; results: RaceResult[] }
interface SwimmerOpt { id: string; name: string; isPrimary: boolean }

const DISC_ORDER = ["50 P", "100 P", "200 P", "50 K", "100 K", "200 K", "50 Z", "100 Z", "50 M", "100 M", "100 O", "200 O"];
const LABELS: Record<string, string> = {
  "50 P": "50 prsa", "100 P": "100 prsa", "200 P": "200 prsa", "50 K": "50 kraul", "100 K": "100 kraul",
  "200 K": "200 kraul", "50 Z": "50 znak", "100 Z": "100 znak", "50 M": "50 motýlek", "100 M": "100 motýlek",
  "100 O": "100 polohovka", "200 O": "200 polohovka",
};

function fmt(ms: number, isDsq = false): string {
  if (isDsq || ms >= 6_000_000) return "DSQ";
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  const str = s.toFixed(2).replace(".", ",");
  return m ? `${m}:${s < 10 ? "0" : ""}${str}` : str;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

export default function DuelClient({ swimmers }: { swimmers: SwimmerOpt[] }) {
  const [swimmerId, setSwimmerId] = useState(swimmers.find((s) => s.isPrimary)?.id ?? swimmers[0]?.id ?? "");
  const [days, setDays] = useState<RaceDay[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) return;
    setLoading(true);
    fetch(`/api/swimmer-races?swimmerId=${swimmerId}`)
      .then((r) => r.json())
      .then((d) => {
        const ds: RaceDay[] = d.days ?? [];
        setDays(ds);
        // default: two most recent race days
        setA(ds.length >= 2 ? ds[ds.length - 2].date : ds[0]?.date ?? "");
        setB(ds[ds.length - 1]?.date ?? "");
      })
      .finally(() => setLoading(false));
  }, [swimmerId]);

  const dayA = days.find((d) => d.date === a);
  const dayB = days.find((d) => d.date === b);

  const rows = useMemo(() => {
    if (!dayA || !dayB) return [];
    const map = new Map<string, { a?: RaceResult; b?: RaceResult }>();
    for (const r of dayA.results) map.set(r.disc, { ...(map.get(r.disc) ?? {}), a: r });
    for (const r of dayB.results) map.set(r.disc, { ...(map.get(r.disc) ?? {}), b: r });
    return [...map.entries()]
      .sort((x, y) => DISC_ORDER.indexOf(x[0]) - DISC_ORDER.indexOf(y[0]))
      .map(([disc, v]) => {
        const diff = v.a && v.b && !v.a.isDsq && !v.b.isDsq && v.a.time < 6_000_000 && v.b.time < 6_000_000
          ? v.b.time - v.a.time
          : null;
        return { disc, a: v.a, b: v.b, diff };
      });
  }, [dayA, dayB]);

  const diffs = rows.filter((r) => r.diff != null).map((r) => r.diff!) ;
  const avg = diffs.length ? diffs.reduce((s, d) => s + d, 0) / diffs.length : null;
  const poolMismatch = dayA && dayB && dayA.pool !== dayB.pool;

  const sel = "rounded-xl border-2 border-pool-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-pool-400 w-full";

  return (
    <div className="flex flex-col gap-4">
      {swimmers.length > 1 && (
        <select value={swimmerId} onChange={(e) => setSwimmerId(e.target.value)} className={sel}>
          {swimmers.map((s) => (
            <option key={s.id} value={s.id}>{s.isPrimary ? "⭐ " : ""}{s.name}</option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pool-500 mb-1">Závod A</p>
          <select value={a} onChange={(e) => setA(e.target.value)} className={sel}>
            {days.map((d) => (
              <option key={d.date} value={d.date}>{fmtDate(d.date)} · {d.title.slice(0, 30)}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pool-500 mb-1">Závod B</p>
          <select value={b} onChange={(e) => setB(e.target.value)} className={sel}>
            {days.map((d) => (
              <option key={d.date} value={d.date}>{fmtDate(d.date)} · {d.title.slice(0, 30)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white border border-pool-100 h-48 animate-pulse" />
      ) : dayA && dayB ? (
        <>
          {poolMismatch && (
            <p className="rounded-xl bg-medal/15 border border-medal/40 px-3 py-2 text-xs text-pool-900/70">
              ⚠️ Různé bazény ({dayA.pool}m vs. {dayB.pool}m) — časy nejsou přímo srovnatelné.
            </p>
          )}
          <div className="rounded-2xl bg-white border border-pool-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-pool-900/50 border-b border-pool-100">
                  <th className="px-3 py-2.5">Disciplína</th>
                  <th className="px-2 py-2.5 text-right">{fmtDate(dayA.date)}</th>
                  <th className="px-2 py-2.5 text-right">{fmtDate(dayB.date)}</th>
                  <th className="px-3 py-2.5 text-right">Rozdíl</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pool-50">
                {rows.map((r) => (
                  <tr key={r.disc}>
                    <td className="px-3 py-2.5 font-semibold text-pool-900">{LABELS[r.disc] ?? r.disc}</td>
                    <td className="px-2 py-2.5 text-right">{r.a ? fmt(r.a.time, r.a.isDsq) : "—"}</td>
                    <td className="px-2 py-2.5 text-right">{r.b ? fmt(r.b.time, r.b.isDsq) : "—"}</td>
                    <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                      r.diff == null ? "text-pool-900/30" : r.diff <= 0 ? "text-emerald-600" : "text-coral"
                    }`}>
                      {r.diff == null ? "—" : `${r.diff <= 0 ? "−" : "+"}${(Math.abs(r.diff) / 1000).toFixed(2).replace(".", ",")} s`}
                    </td>
                  </tr>
                ))}
              </tbody>
              {avg != null && diffs.length >= 2 && (
                <tfoot>
                  <tr className="border-t-2 border-pool-100 bg-pool-50/50">
                    <td className="px-3 py-2.5 font-bold text-pool-900" colSpan={3}>
                      Průměr ({diffs.length} společných disciplín)
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${avg <= 0 ? "text-emerald-600" : "text-coral"}`}>
                      {avg <= 0 ? "−" : "+"}{(Math.abs(avg) / 1000).toFixed(2).replace(".", ",")} s
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-pool-900/40">Zeleně = závod B rychlejší. Bez mezičasů; DSQ se do rozdílů nepočítá.</p>
        </>
      ) : (
        <p className="text-sm text-pool-900/50">Vyber dva závody.</p>
      )}
    </div>
  );
}
