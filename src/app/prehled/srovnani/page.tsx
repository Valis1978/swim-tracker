import { requireRole } from "@/lib/auth";
import Nav from "@/components/Nav";
import PrehledTabs from "@/components/PrehledTabs";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function SrovnaniPage() {
  await requireRole(true);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-pool-800">Srovnání plavkyň 📈</h1>
      <PrehledTabs />
      <CompareClient />
      <Nav />
    </main>
  );
}
