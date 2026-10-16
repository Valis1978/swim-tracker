import Link from "next/link";
import { requireRole } from "@/lib/auth";
import Nav from "@/components/Nav";
import { getSwimmers, kidSeesPlaces } from "@/lib/queries";
import { db } from "@/lib/db";
import WatchlistManager from "./WatchlistManager";
import PlacesToggle from "./PlacesToggle";

export const dynamic = "force-dynamic";

export default async function NastaveniPage() {
  await requireRole(true);
  const [swimmers, places] = await Promise.all([getSwimmers(), kidSeesPlaces()]);
  const { data: lastSync } = await db().from("swim_settings").select("value").eq("key", "last_sync").maybeSingle();
  const lastSyncAt = (lastSync?.value as { at?: string } | null)?.at ?? null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-6">
      <h1 className="text-[1.9rem] font-extrabold text-pool-900">Nastavení</h1>
      <PlacesToggle initial={places} />
      <Link href="/animace" className="flex items-center justify-between rounded-3xl border border-pool-100 bg-white p-4 hover:bg-pool-50">
        <span>
          <span className="block font-bold text-pool-900">Ukázky animací</span>
          <span className="block text-xs text-pool-900/55">skok, náhradnice, osobák, medaile, závod znovu</span>
        </span>
        <span aria-hidden="true" className="text-pool-300">→</span>
      </Link>
      <WatchlistManager
        swimmers={swimmers.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          club: s.club_abbrev ?? s.club_name ?? "",
          isPrimary: s.is_primary,
          cspsUserId: s.csps_user_id,
        }))}
        lastSyncAt={lastSyncAt}
      />
      <section className="text-xs text-pool-900/50 leading-relaxed">
        <p className="font-semibold text-pool-900/70 mb-1">Jak najdu ID plavce?</p>
        <p>
          Na vysledky.czechswimming.cz vyhledej plavce a otevři jeho kartu — číslo v adrese je jeho ID
          (např. …/plavci/<b>63483039</b>). Data se stahují z veřejných výsledků ČSPS jednou denně.
        </p>
      </section>
      <Nav />
    </main>
  );
}
