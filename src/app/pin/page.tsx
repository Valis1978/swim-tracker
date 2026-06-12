"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PinForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(params.get("next") ?? "/viki");
      router.refresh();
    } else {
      setError("To není správný PIN, zkus to znovu 🙈");
      setPin("");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-4 w-full max-w-xs">
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="• • • •"
        className="w-full text-center text-3xl tracking-[0.5em] rounded-2xl border-2 border-pool-200 bg-white px-4 py-4 outline-none focus:border-pool-400"
        aria-label="Rodinný PIN"
      />
      {error && <p className="text-coral text-sm font-medium">{error}</p>}
      <button
        type="submit"
        disabled={busy || !pin}
        className="w-full rounded-2xl bg-pool-600 text-white font-bold py-3.5 text-lg disabled:opacity-40 hover:bg-pool-700 transition-colors"
      >
        {busy ? "Otvírám…" : "Vstoupit"}
      </button>
    </form>
  );
}

export default function PinPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 bg-gradient-to-b from-pool-100 to-pool-50">
      <div className="text-6xl float">🏊‍♀️</div>
      <h1 className="text-3xl font-bold text-pool-800">Plavání</h1>
      <p className="text-pool-900/60 text-sm">Zadej PIN</p>
      <Suspense>
        <PinForm />
      </Suspense>
    </main>
  );
}
