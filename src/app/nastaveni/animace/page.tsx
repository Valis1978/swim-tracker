import Link from "next/link";
import Nav from "@/components/Nav";
import MomentCard from "@/components/anim/MomentCard";
import RaceReplay from "@/components/anim/RaceReplay";
import { requireRole } from "@/lib/auth";
import { getLook } from "@/lib/queries";
import type { Moment } from "@/lib/moments";

export const dynamic = "force-dynamic";

// Parent preview of every animation moment with the cap Viki picked (sample data from her real races).
const DEMOS: Moment[] = [
  { kind: "dive", key: "demo:dive", title: "Máš rozlosováno!", text: "Ukázka: zveřejněná startovka nebo ráno v den závodu. Na bloku je číslo její dráhy.", params: { lane: "2" } },
  { kind: "reserve", key: "demo:reserve", title: "Postoupila jsi z náhradnic!", text: "Ukázka: 100 m prsa v Přerově, z náhradnice č. 1 do rozplavby 8.", params: { small: "100 m prsa · Přerov", front: "Náhradnice č. 1", back: "Rozplavba 8 · dráha 2", lane: "2" } },
  { kind: "pb", key: "demo:pb", title: "Nový osobák!", text: "Ukázka: 50 m prsa za 57,90, o 0,45 s rychleji.", params: { label: "50 m PRSA · VIKI", time: "57,90", banner: "NOVÝ OSOBÁK · −0,45 s" } },
  { kind: "medal", key: "demo:medal", title: "3. místo!", text: "Ukázka: medaile, když skončí v ročníku do třetího místa.", params: { place: 3, caption: "3. místo v ročníku 2016", sub: "50 m znak" } },
];

export default async function AnimacePage() {
  await requireRole(true);
  const look = await getLook();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-32 pt-6">
      <Link href="/nastaveni" className="text-sm font-medium text-pool-600 hover:text-pool-800">
        ← Nastavení
      </Link>
      <h1 className="text-[1.9rem] font-extrabold text-pool-900">Ukázky animací</h1>
      <p className="-mt-2 text-sm text-pool-900/60">Takhle je Viki uvidí, když se něco stane. Hrají s čepicí, kterou si vybrala.</p>
      {DEMOS.map((m) => (
        <MomentCard key={m.key} moment={m} look={look} />
      ))}
      <section className="rounded-3xl border border-pool-100 bg-white p-4">
        <h2 className="text-xl font-extrabold text-pool-900">Závod znovu</h2>
        <p className="mt-1 text-sm text-pool-900/60">Kopřivnice 13. 6., 50 m prsa proti rekordu z března.</p>
        <RaceReplay params={{ title: "50 m prsa", distance: 50, pool: 25, me: 57900, meLabel: "Viki · 13. 6.", ghost: 58350, ghostLabel: "rekord 28. 3.", lane: 4, cap: look.cap }} />
      </section>
      <Nav />
    </main>
  );
}
