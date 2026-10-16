// Visual primitives drawn from a competition pool: lane ropes, the lane map, water surface.
import type { RaceStep, Tone } from "@/lib/entries";
import { shortDate } from "@/lib/time";

// "2026-10-15T09:00:00" -> "9:00" (none for midnight-only dates)
function clockOf(dt: string): string | null {
  const t = dt.slice(11, 16);
  return t && t !== "00:00" ? `${Number(t.slice(0, 2))}:${t.slice(3, 5)}` : null;
}

// ---- lane rope -------------------------------------------------------------------
// Real lane ropes alternate colour blocks; we use them as dividers and as a progress track.

const ROPE = ["var(--color-rope-red)", "#ffffff", "var(--color-rope-blue)", "#ffffff"];

export function RopeDivider({ floats = 28, className = "" }: { floats?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: floats }, (_, i) => (
        <span
          key={i}
          className="h-[7px] flex-1 rounded-full ring-1 ring-black/5"
          style={{ background: i < 3 || i >= floats - 3 ? "var(--color-rope-red)" : ROPE[i % 4] }}
        />
      ))}
    </div>
  );
}

const STEP_SHORT: Record<RaceStep["key"], string> = {
  prihlaska: "Přihláška",
  odhlasky: "Odhlášky",
  rozlosovani: "Losování",
  zavod: "Závod",
  vysledky: "Výsledky",
};

export function RaceStepper({ steps }: { steps: RaceStep[] }) {
  return (
    <ol className="grid grid-cols-5 gap-0" aria-label="Průběh závodu">
      {steps.map((s, i) => {
        const done = s.state === "done";
        const now = s.state === "now";
        const leftDone = i > 0 && steps[i - 1].state === "done";
        const date = s.when ? (s.key === "zavod" ? shortDate(s.when) : `do ${shortDate(s.when)}`) : null;
        const time = s.when && s.key !== "zavod" ? clockOf(s.when) : null;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {i > 0 && (
              <div className="absolute top-[13px] right-1/2 left-[-50%] flex gap-[2px] px-[15px]" aria-hidden="true">
                {Array.from({ length: 5 }, (_, k) => (
                  <span
                    key={k}
                    className="h-[6px] flex-1 rounded-full"
                    style={{ background: leftDone || done ? ROPE[(k + i) % 4] : "rgb(17 67 91 / 0.12)", boxShadow: leftDone || done ? "inset 0 0 0 1px rgb(0 0 0 / 0.06)" : undefined }}
                  />
                ))}
              </div>
            )}
            <span
              className={`relative z-10 grid h-[28px] w-[28px] place-items-center rounded-full text-[11px] font-bold ${
                done ? "bg-pool-600 text-white" : now ? "bg-white text-pool-700 ring-2 ring-pool-500 buoy-pulse" : "bg-white text-pool-900/30 ring-1 ring-pool-900/15"
              }`}
            >
              {done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight font-semibold ${now ? "text-pool-800" : done ? "text-pool-900/75" : "text-pool-900/40"}`}>
              {STEP_SHORT[s.key]}
            </span>
            {date && <span className="nums text-[10px] leading-tight text-pool-900/45">{date}</span>}
            {time && <span className="nums text-[10px] leading-tight text-pool-900/35">{time}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ---- lane map --------------------------------------------------------------------
// Top-down pool: lanes as rows, her lane lit. Starting blocks on the left, lane numbers on them.

export function LaneMap({ lane, lanes = 8, label }: { lane: number; lanes?: number; label?: string }) {
  const n = Math.max(lanes, lane);
  const h = 9;
  const W = 132;
  const H = n * h + 4;
  return (
    <figure className="shrink-0" aria-label={label ?? `dráha ${lane}`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
        <rect x="0" y="0" width={W} height={H} rx="6" fill="#0b7fa8" />
        <rect x="16" y="2" width={W - 18} height={H - 4} rx="3" fill="#18a3cd" />
        {Array.from({ length: n }, (_, i) => {
          const y = 2 + i * h;
          const mine = i + 1 === lane;
          return (
            <g key={i}>
              {mine && <rect x="16" y={y} width={W - 18} height={h} fill="#ffe07a" opacity=".95" className="lane-glow" />}
              <rect x="3" y={y + 1.2} width="11" height={h - 2.4} rx="2" fill={mine ? "#ffe07a" : "#e9f8fd"} />
              <text x="8.5" y={y + h - 2.4} textAnchor="middle" fontSize="6.5" fontWeight="800" fill={mine ? "#7a4b00" : "#0a6182"}>
                {i + 1}
              </text>
              {i > 0 && (
                <line x1="16" x2={W - 2} y1={y} y2={y} stroke="white" strokeOpacity=".7" strokeWidth="1" strokeDasharray="2.5 2" />
              )}
              {mine && <circle cx="30" cy={y + h / 2} r="2.6" fill="#7a4b00" />}
            </g>
          );
        })}
        {/* T-line at the far wall */}
        <line x1={W - 8} x2={W - 8} y1="3" y2={H - 3} stroke="#0a6182" strokeOpacity=".35" strokeWidth="1.5" />
      </svg>
    </figure>
  );
}

// ---- status chip -----------------------------------------------------------------

const TONE: Record<Tone, string> = {
  wait: "bg-pool-50 text-pool-700 ring-pool-200",
  reserve: "bg-[#fff4dc] text-[#8a5300] ring-[#f6c96f]",
  ok: "bg-[#e3f8ef] text-[#07704b] ring-[#99dfbf]",
  drawn: "bg-pool-600 text-white ring-pool-700",
  off: "bg-[#eef2f4] text-[#5b6b75] ring-[#d5dde2]",
  done: "bg-white text-pool-800 ring-pool-200",
  dsq: "bg-[#ffecea] text-[#b3261e] ring-[#f5b9b3]",
};

const DOT: Record<Tone, string> = {
  wait: "bg-pool-400",
  reserve: "bg-[#f0a500]",
  ok: "bg-[#12a874]",
  drawn: "bg-white",
  off: "bg-[#9aa8b0]",
  done: "bg-pool-500",
  dsq: "bg-[#d93a2f]",
};

export function StatusChip({ tone, children, className = "" }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 whitespace-nowrap ${TONE[tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ToneDot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${tone === "drawn" ? "bg-pool-600" : DOT[tone]} ${className}`} aria-hidden="true" />;
}

// A row of floats summarising a race: one float per event, coloured by status.
export function StatusRope({ tones }: { tones: Tone[] }) {
  const color: Record<Tone, string> = {
    wait: "#9fdcef",
    reserve: "#f6b73c",
    ok: "#19b27c",
    drawn: "#0879a0",
    off: "#c9d3d9",
    done: "#0879a0",
    dsq: "#e0574c",
  };
  return (
    <div className="flex gap-1" aria-hidden="true">
      {tones.map((t, i) => (
        <span key={i} className="h-2 flex-1 max-w-10 rounded-full ring-1 ring-black/5" style={{ background: color[t] }} />
      ))}
    </div>
  );
}

// ---- water surface hero ----------------------------------------------------------

export function WaterHero({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <header className={`relative overflow-hidden rounded-[28px] bg-deep text-white shadow-[0_18px_40px_-18px_rgb(5_39_58/0.6)] ${className}`}>
      {/* caustics: soft light patches drifting over the pool floor */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="caustic-a absolute -left-1/4 -top-1/3 h-[140%] w-[90%] rounded-full bg-[radial-gradient(closest-side,rgb(44_181_218/0.55),transparent)] blur-2xl" />
        <div className="caustic-b absolute -right-1/4 top-0 h-[120%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(14_151_191/0.6),transparent)] blur-2xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.16] mix-blend-screen" viewBox="0 0 400 220" preserveAspectRatio="none">
          <path d="M-10 60c40-18 70 12 110-4s70-30 110-10 70 18 110 0 60-14 90-6" stroke="white" strokeWidth="1.4" fill="none" />
          <path d="M-10 110c50-22 80 16 120 0s60-26 105-6 75 20 115 2 50-10 80-4" stroke="white" strokeWidth="1.1" fill="none" />
          <path d="M-10 160c40-14 75 12 115-2s70-24 110-6 70 16 110 0 55-10 85-2" stroke="white" strokeWidth="0.9" fill="none" />
        </svg>
      </div>
      <div className="relative">{children}</div>
      {/* lane rope along the bottom edge */}
      <div className="relative px-5 pb-4">
        <RopeDivider floats={24} className="opacity-90" />
      </div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[1.35rem] font-extrabold text-pool-900">{children}</h2>
      {action}
    </div>
  );
}
