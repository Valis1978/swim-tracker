"use client";

import { useEffect, useMemo, useState } from "react";

interface Point { date: string; time: number; location: string }
interface SwimmerSeries { id: string; name: string; isPrimary: boolean; series: Point[] }

const DISCIPLINES = ["50 P", "100 P", "50 K", "100 K", "50 Z", "100 Z", "50 M", "100 O"];
const LABELS: Record<string, string> = {
  "50 P": "50 prsa", "100 P": "100 prsa", "50 K": "50 kraul", "100 K": "100 kraul",
  "50 Z": "50 znak", "100 Z": "100 znak", "50 M": "50 motýlek", "100 O": "100 polohovka",
};
const COLORS = ["#0879a0", "#f5a623", "#ff6b5e", "#7c3aed", "#059669", "#db2777", "#475569", "#b45309"];

function fmt(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  const str = s.toFixed(2).replace(".", ",");
  return m ? `${m}:${s < 10 ? "0" : ""}${str}` : str;
}

export default function CompareClient() {
  const [discipline, setDiscipline] = useState("50 P");
  const [data, setData] = useState<SwimmerSeries[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/compare?discipline=${encodeURIComponent(discipline)}`)
      .then((r) => r.json())
      .then((d) => {
        const swimmers: SwimmerSeries[] = d.swimmers ?? [];
        setData(swimmers);
        setSelected((prev) => {
          const next = new Set([...prev].filter((id) => swimmers.some((s) => s.id === id)));
          if (next.size === 0) for (const s of swimmers.filter((x) => x.isPrimary)) next.add(s.id);
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, [discipline]);

  const active = useMemo(() => data.filter((s) => selected.has(s.id)), [data, selected]);

  const chart = useMemo(() => {
    const pts = active.flatMap((s) => s.series);
    if (pts.length < 2) return null;
    const dates = pts.map((p) => +new Date(p.date));
    const times = pts.map((p) => p.time);
    const x0 = Math.min(...dates), x1 = Math.max(...dates);
    const t0 = Math.min(...times), t1 = Math.max(...times);
    const W = 720, H = 320, PL = 56, PR = 16, PT = 12, PB = 28;
    const xs = (d: number) => PL + ((d - x0) / Math.max(1, x1 - x0)) * (W - PL - PR);
    const ys = (t: number) => PT + ((t - t0) / Math.max(1, t1 - t0)) * (H - PT - PB);
    // y gridlines: 4 nice time steps
    const grid = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
    return { W, H, PL, PR, PT, PB, xs, ys, x0, x1, t0, t1, grid };
  }, [active]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={discipline}
        onChange={(e) => setDiscipline(e.target.value)}
        className="rounded-xl border-2 border-pool-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-pool-400"
      >
        {DISCIPLINES.map((d) => (
          <option key={d} value={d}>{LABELS[d]}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        {data.map((s, i) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border-2 transition-colors ${
              selected.has(s.id)
                ? "text-white border-transparent"
                : "bg-white text-pool-900/60 border-pool-200"
            }`}
            style={selected.has(s.id) ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}
          >
            {s.isPrimary && "⭐ "}{s.name} ({s.series.length})
          </button>
        ))}
        {!loading && data.length === 0 && (
          <p className="text-sm text-pool-900/50">V této disciplíně nemá žádný sledovaný plavec výsledek.</p>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white border border-pool-100 h-72 animate-pulse" />
      ) : chart ? (
        <div className="rounded-2xl bg-white border border-pool-100 shadow-sm p-3 overflow-x-auto">
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full min-w-[560px]">
            {chart.grid.map((t, i) => (
              <g key={i}>
                <line x1={chart.PL} x2={chart.W - chart.PR} y1={chart.ys(t)} y2={chart.ys(t)} stroke="#e6f4f9" strokeWidth="1" />
                <text x={chart.PL - 6} y={chart.ys(t) + 4} textAnchor="end" fontSize="11" fill="#6b8a99">{fmt(Math.round(t / 10) * 10)}</text>
              </g>
            ))}
            <text x={chart.PL} y={chart.H - 8} fontSize="11" fill="#6b8a99">
              {new Date(chart.x0).toLocaleDateString("cs-CZ")}
            </text>
            <text x={chart.W - chart.PR} y={chart.H - 8} textAnchor="end" fontSize="11" fill="#6b8a99">
              {new Date(chart.x1).toLocaleDateString("cs-CZ")}
            </text>
            {active.map((s) => {
              const i = data.findIndex((d) => d.id === s.id);
              const color = COLORS[i % COLORS.length];
              const d = s.series
                .map((p, j) => `${j ? "L" : "M"}${chart.xs(+new Date(p.date)).toFixed(1)},${chart.ys(p.time).toFixed(1)}`)
                .join(" ");
              return (
                <g key={s.id}>
                  <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {s.series.map((p, j) => (
                    <circle key={j} cx={chart.xs(+new Date(p.date))} cy={chart.ys(p.time)} r="4" fill={color}>
                      <title>{`${s.name} · ${new Date(p.date).toLocaleDateString("cs-CZ")} · ${fmt(p.time)} · ${p.location}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
          <p className="text-[11px] text-pool-900/40 px-1 pt-1">Výš = rychlejší (osa časů je obrácená). Jen 25m bazén, bez mezičasů a diskvalifikací.</p>
        </div>
      ) : (
        <p className="text-sm text-pool-900/50">Vyber aspoň jednu plavkyni s více výsledky.</p>
      )}

      {active.length > 0 && (
        <div className="rounded-2xl bg-white border border-pool-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-pool-900/50 border-b border-pool-100">
                <th className="px-4 py-2.5">Plavkyně</th>
                <th className="px-2 py-2.5 text-right">Osobák</th>
                <th className="px-2 py-2.5 text-right">Poslední</th>
                <th className="px-4 py-2.5 text-right">Rozdíl</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pool-50">
              {active.map((s) => {
                const pb = Math.min(...s.series.map((p) => p.time));
                const last = s.series[s.series.length - 1];
                const diff = last.time - pb;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-medium text-pool-900">{s.isPrimary && "⭐ "}{s.name}</td>
                    <td className="px-2 py-2.5 text-right font-bold">{fmt(pb)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(last.time)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${diff > 0 ? "text-coral" : "text-emerald-600"}`}>
                      {diff === 0 ? "= osobák" : `+${(diff / 1000).toFixed(2).replace(".", ",")} s`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
