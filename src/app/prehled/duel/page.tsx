import Nav from "@/components/Nav";
import PrehledTabs from "@/components/PrehledTabs";
import { getSwimmers } from "@/lib/queries";
import DuelClient from "./DuelClient";

export const dynamic = "force-dynamic";

export default async function DuelPage() {
  const swimmers = await getSwimmers();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-pool-800">Závod vs. závod ⚔️</h1>
      <PrehledTabs />
      <DuelClient
        swimmers={swimmers.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          isPrimary: s.is_primary,
        }))}
      />
      <Nav />
    </main>
  );
}
