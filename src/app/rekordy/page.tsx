import Link from "next/link";
import Nav from "@/components/Nav";
import { StrokeGlyph } from "@/components/Glyphs";
import { WaterHero } from "@/components/Pool";
import { RecordCard } from "@/components/Race";
import { requireRole } from "@/lib/auth";
import { getPrimary, getResults } from "@/lib/queries";
import { computeRecords } from "@/lib/records";
import { STROKE_META, STROKE_ORDER } from "@/lib/strokes";

export const dynamic = "force-dynamic";

export default async function RekordyPage({ searchParams }: { searchParams: Promise<{ bazen?: string }> }) {
  const role = await requireRole();
  const { bazen } = await searchParams;
  const primary = await getPrimary();
  const results = primary ? await getResults(primary.id) : [];
  const short = computeRecords(results, 25);
  const long = computeRecords(results, 50);
  const pool = bazen === "50" ? 50 : bazen === "25" ? 25 : short.length ? 25 : 50;
  const list = pool === 25 ? short : long;
  const strokes = STROKE_ORDER.filter((s) => list.some((r) => r.stroke === s));
  const order = new Map(list.map((r, i) => [r.discipline, i]));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-32 pt-4">
      <WaterHero>
        <div className="px-5 pt-5 pb-4">
          <p className="text-sm font-semibold text-pool-200">nejlepší časy</p>
          <h1 className="mt-1 text-[2.1rem] font-extrabold leading-none">Moje rekordy</h1>
          <p className="mt-2 text-sm text-pool-100/80">
            {short.length + long.length} {short.length + long.length < 5 ? "rekordy" : "rekordů"} ve dvou bazénech
          </p>
        </div>
      </WaterHero>

      <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 ring-1 ring-pool-100" aria-label="Typ bazénu">
        {[
          { len: 25, name: "Krátký bazén", n: short.length },
          { len: 50, name: "Dlouhý bazén", n: long.length },
        ].map((t) => (
          <Link
            key={t.len}
            href={`/rekordy?bazen=${t.len}`}
            aria-current={pool === t.len ? "page" : undefined}
            className={`rounded-xl px-3 py-2.5 text-center transition ${pool === t.len ? "bg-deep text-white shadow-md" : "text-pool-900/60 hover:bg-pool-50"}`}
          >
            <span className="display block text-xl font-extrabold leading-none">{t.len} m</span>
            <span className={`text-[11px] font-semibold ${pool === t.len ? "text-pool-100" : "text-pool-900/45"}`}>
              {t.name} · {t.n}
            </span>
          </Link>
        ))}
      </nav>

      {strokes.map((s) => (
        <section key={s}>
          <h2 className="mb-2.5 flex items-center gap-2 text-[1.3rem] font-extrabold text-pool-900">
            <StrokeGlyph stroke={s} size={28} />
            {STROKE_META[s].label}
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {list
              .filter((r) => r.stroke === s)
              .map((r) => (
                <RecordCard key={r.discipline} r={r} delay={(order.get(r.discipline) ?? 0) * 50 + 50} />
              ))}
          </div>
        </section>
      ))}

      {list.length === 0 && (
        <p className="rounded-3xl border border-dashed border-pool-200 bg-white/60 p-6 text-center text-sm text-pool-900/55">
          V {pool === 25 ? "krátkém" : "dlouhém"} bazénu zatím žádný čas není. Po prvním závodě se tu objeví.
        </p>
      )}

      <p className="text-xs leading-relaxed text-pool-900/45">
        Krátký bazén má 25 m, dlouhý 50 m. V dlouhém jsou časy pomalejší, protože je v něm méně obrátek, a proto má každý bazén
        vlastní rekordy. Mezičas je čas změřený uvnitř delší trati (třeba prvních 50 m ze 100) a svaz ho vede jako oficiální.
      </p>
      <Nav role={role} />
    </main>
  );
}
