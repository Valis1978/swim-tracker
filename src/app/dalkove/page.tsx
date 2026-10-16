import Nav from "@/components/Nav";
import OpenWaterSection from "@/components/OpenWaterSection";
import { requireRole } from "@/lib/auth";
import { getPrimary, getOpenWaterResults, getAllOpenWater, kidSeesPlaces, OwResult } from "@/lib/queries";
import { WaterHero } from "@/components/Pool";

export const dynamic = "force-dynamic";

export default async function DalkovePage() {
  const role = await requireRole();

  if (role === "kid") {
    const primary = await getPrimary();
    const [results, showPlace] = await Promise.all([primary ? getOpenWaterResults(primary.id) : Promise.resolve([]), kidSeesPlaces()]);
    const done = results.filter((r) => r.status === "result");
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-4">
        <WaterHero>
          <div className="px-5 pt-5 pb-4">
            <p className="text-sm font-semibold text-pool-200">otevřená voda</p>
            <h1 className="mt-1 text-[2.1rem] font-extrabold leading-none">Dálkové plavání</h1>
            <p className="mt-2 text-sm text-pool-100/80">
              {done.length} {done.length === 1 ? "odplavaný závod" : done.length < 5 ? "odplavané závody" : "odplavaných závodů"}
            </p>
          </div>
        </WaterHero>
        {results.length > 0 ? (
          <OpenWaterSection results={results} heading="Moje dálkové závody" kid showPlace={showPlace} />
        ) : (
          <p className="py-8 text-center text-sm text-pool-900/50">
            Zatím tu žádný dálkový závod není.
            <br />
            Až nějaký poplaveš, objeví se tu.
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
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-6">
      <header>
        <h1 className="text-[1.9rem] font-extrabold text-pool-900">Dálkové plavání</h1>
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
            heading={g.name}
          />
        ))
      )}
      <Nav role={role} />
    </main>
  );
}
