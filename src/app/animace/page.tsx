import Link from "next/link";
import Nav from "@/components/Nav";
import MomentCard from "@/components/anim/MomentCard";
import RaceReplay from "@/components/anim/RaceReplay";
import { WaterHero } from "@/components/Pool";
import { requireRole } from "@/lib/auth";
import { getCompetitionsByIds, getLook, getPrimary, getResults, getSwimmerEntries, kidSeesPlaces } from "@/lib/queries";
import { replayParamsFor } from "@/lib/replay_params";
import type { Moment } from "@/lib/moments";

export const dynamic = "force-dynamic";

// Every animation moment, playable any time, with the cap Viki picked. The two "real" ones use her real races.
const DEMOS: Moment[] = [
  { kind: "dive", key: "gallery:day", title: "Dnes závodíš!", text: "Ráno v den závodu: na bloku v oddílovém tričku, zamávat, tričko dolů a skok.", params: { lane: "4", intro: "tee" } },
  { kind: "dive", key: "gallery:drawn", title: "Máš rozlosováno!", text: "Když vyjde startovka. Na bloku je číslo tvé dráhy.", params: { lane: "2" } },
  { kind: "reserve", key: "gallery:reserve", title: "Postoupila jsi z náhradnic!", text: "Tohle se ti stalo v Přerově na 100 m prsa: z náhradnice č. 1 do 8. rozplavby.", params: { small: "100 m prsa · Přerov", front: "Náhradnice č. 1", back: "Rozplavba 8 · dráha 2", lane: "2" } },
  { kind: "pb", key: "gallery:pb", title: "Nový osobák!", text: "Tvůj osobák 57,90 na 50 m prsa z Kopřivnice.", params: { label: "50 m PRSA · VIKI", time: "57,90", banner: "NOVÝ OSOBÁK · −0,45 s" } },
  { kind: "medal", key: "gallery:medal", title: "Až vybojuješ medaili", text: "Takhle to bude vypadat, až budeš v ročníku do třetího místa.", params: { place: 1, caption: "Tvoje medaile", sub: "do 3. místa v ročníku" } },
];

export default async function AnimacePage() {
  const role = await requireRole();
  const parent = role === "parent";
  const [look, primary, kidPlaces] = await Promise.all([getLook(), getPrimary(), kidSeesPlaces()]);
  // a real replay: her latest swum race that has the heat recorded
  let replay = null;
  if (primary) {
    const [entries, results] = await Promise.all([getSwimmerEntries(primary.id), getResults(primary.id)]);
    const e = entries.find((x) => x.status === "swum" && x.field && x.field.racers.length > 1);
    const comp = e ? (await getCompetitionsByIds([e.competition_csps_id])).get(e.competition_csps_id) : undefined;
    if (e && comp) replay = { comp, params: replayParamsFor(e, comp, results, { nick: "Viki", cap: look.cap, birthYear: primary.birth_year, showField: parent || kidPlaces }) };
  }
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-32 pt-4">
      <WaterHero>
        <div className="px-5 pt-4 pb-4">
          <Link href={parent ? "/nastaveni" : "/viki"} className="text-sm font-medium text-pool-100/80 hover:text-white">
            ← {parent ? "Nastavení" : "Domů"}
          </Link>
          <h1 className="mt-2 text-[2.1rem] font-extrabold leading-none">Animace</h1>
          <p className="mt-2 text-sm text-pool-100/80">
            Takhle appka slaví, když se něco stane. {parent ? "Hrají s čepicí, kterou si Viki vybrala." : "Hrají s tvou čepicí."}
          </p>
        </div>
      </WaterHero>
      {DEMOS.map((m) => (
        <MomentCard key={m.key} moment={m} look={look} />
      ))}
      {replay?.params && (
        <section className="rounded-3xl border border-pool-100 bg-white p-4">
          <h2 className="text-xl font-extrabold text-pool-900">Závod znovu</h2>
          <p className="mt-1 text-sm text-pool-900/60">
            {replay.params.title} · {replay.comp.title}. Přepni si pohled nad přehrávačem.
          </p>
          <RaceReplay params={replay.params} />
        </section>
      )}
      <Nav role={role} />
    </main>
  );
}
