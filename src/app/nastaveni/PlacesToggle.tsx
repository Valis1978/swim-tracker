"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PlacesToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    const next = !on;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kidShowPlaces: next }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (d?.success) {
      setOn(next);
      router.refresh();
    } else {
      setErr(d?.error ?? "Nepodařilo se uložit");
    }
  }

  return (
    <section className="rounded-3xl border border-pool-100 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-pool-900">Viki vidí pořadí na závodech</p>
          <p className="mt-1 text-xs leading-relaxed text-pool-900/55">
            Umístění mezi holkami stejného ročníku u každé odplavané trati, v dálkovém plavání umístění v závodě. Celkové pořadí a
            srovnání s ostatními vidíš jen ty.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Viki vidí pořadí na závodech"
          disabled={busy}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-pool-600" : "bg-pool-900/20"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-coral">{err}</p>}
    </section>
  );
}
