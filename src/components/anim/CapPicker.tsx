"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAP_FRONT_HALF, CAP_PATH, CAP_SEAM, CAPS, CLUB_BLUE, CLUB_CYAN, type CapKey, type CapStyle } from "@/lib/anim/look";

const INK = "#08324a";

// the cartoon head in profile wearing a cap (same drawing as in the animations)
export function CapHead({ cap, size = 52 }: { cap: CapStyle; size?: number }) {
  const clip = `capclip-${cap.key}`;
  return (
    <svg width={size} height={size} viewBox="-15 -15 30 30" aria-hidden="true">
      <g transform="rotate(-90)">
        <circle r="10.5" fill="#f3c6a5" stroke={INK} strokeWidth="1.6" />
        <clipPath id={clip}>
          <path d={CAP_PATH} />
        </clipPath>
        <path d={CAP_PATH} fill={cap.base} />
        {cap.split && (
          <g clipPath={`url(#${clip})`}>
            <path d={CAP_FRONT_HALF} fill={cap.split} />
            <path d={CAP_SEAM} stroke={INK} strokeWidth="0.9" opacity="0.45" fill="none" />
            {cap.mark && (
              <g transform="translate(4.6 -4.4) rotate(20) scale(0.36)">
                <path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke={CLUB_BLUE} strokeWidth="3.6" strokeLinecap="round" fill="none" />
                <circle cx="7.5" cy="-8.5" r="2.8" fill={CLUB_CYAN} />
              </g>
            )}
          </g>
        )}
        <path d={CAP_PATH} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        {!cap.split && <path d="M3.6,-6.4 A7.6,7.6 0 0 1 7.1,-2.6" stroke={cap.hi} strokeWidth="2" strokeLinecap="round" fill="none" />}
        <path d="M9.9,3.2 A10.4,10.4 0 0 0 -5,-9.1" stroke={INK} strokeWidth="1.4" fill="none" opacity="0.9" />
        <ellipse cx="4.4" cy="6.4" rx="3.9" ry="2.8" transform="rotate(-30 4.4 6.4)" fill="#0b3a5a" stroke={INK} strokeWidth="1.1" />
        <circle cx="5.6" cy="5.6" r="1" fill="#bff3ff" />
        <path d="M-4.4,4.6 Q-3.6,7.6 -0.8,7.9" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function CapPicker({ initial }: { initial: CapKey }) {
  const [cap, setCap] = useState<CapKey>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function choose(k: CapKey) {
    if (k === cap || busy) return;
    const prev = cap;
    setCap(k);
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cap: k }),
    }).catch(() => null);
    const d = res ? ((await res.json().catch(() => null)) as { success?: boolean } | null) : null;
    setBusy(false);
    if (d?.success) router.refresh();
    else {
      setCap(prev);
      setErr("Čepici se nepodařilo uložit, zkus to znovu.");
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.35rem] font-extrabold text-pool-900">Moje čepice</h2>
        <span className="text-xs text-pool-900/45">plave s ní tvoje postavička</span>
      </div>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Barva čepice">
        {CAPS.map((c) => {
          const on = c.key === cap;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(c.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border bg-white px-1 pb-2 pt-1.5 transition ${
                on ? "border-pool-600 ring-2 ring-pool-500 ring-offset-1" : "border-pool-100 hover:border-pool-300"
              }`}
            >
              <CapHead cap={c} />
              <span className={`text-[11px] font-semibold leading-tight ${on ? "text-pool-800" : "text-pool-900/60"}`}>{c.label}</span>
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-coral">{err}</p>}
    </section>
  );
}
