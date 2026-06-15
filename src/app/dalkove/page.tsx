import Nav from "@/components/Nav";
import OpenWaterSection from "@/components/OpenWaterSection";
import { getRole } from "@/lib/auth";
import { getPrimary, getOpenWaterResults, getAllOpenWater, OwResult } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DalkovePage() {
  const role = (await getRole()) ?? "kid";

  if (role === "kid") {
    const primary = await getPrimary();
    const results = primary ? await getOpenWaterResults(primary.id) : [];
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
        <header className="rounded-3xl bg-gradient-to-br from-pool-400 to-pool-700 text-white p-6 relative overflow-hidden">
          <div className="absolute -right-3 -bottom-4 text-7xl opacity-25 float">🌊</div>
          <p className="text-pool-100 text-sm font-medium">otevřená voda</p>
          <h1 className="text-3xl font-bold mt-1">Dálkové plavání</h1>
        </header>
        {results.length > 0 ? (
          <OpenWaterSection results={results} heading="Moje dálkové závody" kid />
        ) : (
          <p className="text-center text-pool-900/50 text-sm py-8">
            Zatím tu žádný dálkový závod není. 🌊<br />Až nějaký poplaveš, objeví se tu.
          </p>
        )}
        <Nav role={role} />
      </main>
    );
  }

  // parent: all tracked swimmers' open water, primary first
  const all = await getAllOpenWater();
  const groups = new Map<string, { name: string; isPrimary: boolean; results: OwResult[] }>();
  for (const r of all) {
    const key = r.swimmer_id;
    if (!groups.has(key)) {
      groups.set(key, {
        name: `${r.swimmer.first_name} ${r.swimmer.last_name}`,
        isPrimary: r.swimmer.is_primary,
        results: [],
      });
    }
    groups.get(key)!.results.push(r);
  }
  const ordered = [...groups.values()].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "cs"));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-pool-800">Dálkové plavání 🌊</h1>
        <p className="text-sm text-pool-900/50 mt-1">
          Otevřená voda — vlastní svět svazu. Pořadí = umístění v závodě (celostátní žebříčky se pro dálkové nevedou).
        </p>
      </header>
      {ordered.length === 0 ? (
        <p className="text-pool-900/50 text-sm">Zatím žádné dálkové závody u sledovaných plavců.</p>
      ) : (
        ordered.map((g) => (
          <OpenWaterSection
            key={g.name}
            results={g.results}
            heading={`${g.isPrimary ? "⭐ " : ""}${g.name}`}
          />
        ))
      )}
      <Nav role={role} />
    </main>
  );
}
