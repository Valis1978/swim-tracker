"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  club: string;
  isPrimary: boolean;
  cspsUserId: number;
}

export default function WatchlistManager({ swimmers, lastSyncAt }: { swimmers: Row[]; lastSyncAt: string | null }) {
  const [newId, setNewId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function addSwimmer(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setMsg(null);
    const res = await fetch("/api/swimmers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cspsUserId: Number(newId) }),
    });
    const d = await res.json();
    setBusy(null);
    if (d.success) {
      setNewId("");
      setMsg(`Přidáno: ${d.swimmer.first_name} ${d.swimmer.last_name}. Výsledky se objeví po synchronizaci.`);
      router.refresh();
    } else {
      setMsg(`Chyba: ${d.error}`);
    }
  }

  async function removeSwimmer(id: string) {
    setBusy(id);
    await fetch("/api/swimmers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(null);
    router.refresh();
  }

  async function syncNow() {
    setBusy("sync");
    setMsg("Synchronizuji… (může trvat minutu)");
    const res = await fetch("/api/sync-now", { method: "POST" });
    const d = await res.json().catch(() => ({ success: false, error: "timeout" }));
    setBusy(null);
    setMsg(d.success ? `Hotovo — ${d.newResults} nových výsledků.` : `Chyba: ${d.error}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-white border border-pool-100 shadow-sm divide-y divide-pool-50">
        {swimmers.map((s) => (
          <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium text-pool-900">
                {s.isPrimary && "⭐ "}
                {s.name}
              </span>
              <span className="text-pool-900/40 ml-2 text-xs">{s.club} · #{s.cspsUserId}</span>
            </div>
            {!s.isPrimary && (
              <button
                onClick={() => removeSwimmer(s.id)}
                disabled={busy === s.id}
                className="text-coral text-xs font-semibold hover:underline disabled:opacity-40"
              >
                odebrat
              </button>
            )}
          </div>
        ))}
      </section>

      <form onSubmit={addSwimmer} className="flex gap-2">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value.replace(/\D/g, ""))}
          placeholder="ID plavce z ČSPS (např. 63483039)"
          inputMode="numeric"
          className="flex-1 rounded-xl border-2 border-pool-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-pool-400"
        />
        <button
          type="submit"
          disabled={!newId || busy === "add"}
          className="rounded-xl bg-pool-600 text-white font-semibold px-4 text-sm disabled:opacity-40 hover:bg-pool-700"
        >
          Přidat
        </button>
      </form>

      <button
        onClick={syncNow}
        disabled={busy === "sync"}
        className="rounded-xl border-2 border-pool-300 text-pool-700 font-semibold py-2.5 text-sm hover:bg-pool-100 disabled:opacity-40"
      >
        {busy === "sync" ? "Synchronizuji…" : "🔄 Synchronizovat teď"}
      </button>
      {lastSyncAt && (
        <p className="text-xs text-pool-900/40 text-center -mt-2">
          Poslední synchronizace: {new Date(lastSyncAt).toLocaleString("cs-CZ")}
        </p>
      )}
      {msg && <p className="text-sm text-pool-900/70 text-center">{msg}</p>}
    </div>
  );
}
