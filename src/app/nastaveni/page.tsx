import Nav from "@/components/Nav";
import { getSwimmers } from "@/lib/queries";
import { db } from "@/lib/db";
import WatchlistManager from "./WatchlistManager";

export const dynamic = "force-dynamic";

export default async function NastaveniPage() {
  const swimmers = await getSwimmers();
  const { data: lastSync } = await db().from("swim_settings").select("value").eq("key", "last_sync").maybeSingle();
  const lastSyncAt = (lastSync?.value as { at?: string } | null)?.at ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-pool-800">Nastavení ⚙️</h1>
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
