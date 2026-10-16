// "Závod znovu": a race replayed from above. Three views of the same race:
// - ghost: Viki against the ghost of her previous record (self-comparison)
// - heat: her real heat, everyone in their real lane with their real final time
// - year: every swimmer of her birth year in that event, in one virtual pool
// Pacing is modelled (first length a bit faster after the dive); kids' races carry no per-length splits.
import { E, clamp, rnd, type Scene, type SceneFactory } from "./engine";
import { capOf, type CapKey } from "./look";

export type ReplayMode = "ghost" | "heat" | "year";

export interface ReplayParams {
  title: string; // "50 m prsa"
  distance: number; // metres
  pool: 25 | 50;
  me: number; // ms
  meLabel: string; // "Viki · 13. 6."
  ghost: number | null; // previous record, ms
  ghostLabel: string | null; // "rekord 28. 3."
  lane: number | null; // her lane, when known
  cap?: CapKey;
  heatNo?: number | null;
  heat?: { lane: number; year: number; time: number; me: boolean }[] | null;
  year?: number[] | null; // sorted times of swimmers born the same year
  birthYear?: number | null;
}

export function fmtRace(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const r = (s - m * 60).toFixed(2).replace(".", ",");
  return m ? `${m}:${r.padStart(5, "0")}` : r;
}

// metres swum after `ms` of a race of `total` ms; the first length takes ~6 % less than the average
export function distanceAt(ms: number, total: number, distance: number, pool: number): number {
  if (ms <= 0) return 0;
  if (ms >= total) return distance;
  const lengths = Math.max(1, Math.round(distance / pool));
  const avg = total / lengths;
  const first = lengths === 1 ? total : avg * 0.94;
  if (ms < first) return pool * E.out(Math.min(1, ms / first)) * 0.15 + pool * (ms / first) * 0.85;
  const rest = (total - first) / (lengths - 1);
  return pool + ((ms - first) / rest) * pool;
}

// position in metres from the start wall and heading, for a distance into the race
export function positionAt(d: number, pool: number): { m: number; dir: 1 | -1 } {
  const length = Math.min(Math.floor(d / pool), Math.max(0, Math.ceil(d / pool) - 1));
  const into = d - length * pool;
  return length % 2 === 0 ? { m: into, dir: 1 } : { m: pool - into, dir: -1 };
}

export function availableModes(p: ReplayParams): ReplayMode[] {
  const out: ReplayMode[] = [];
  if (p.ghost != null) out.push("ghost");
  if (p.heat && p.heat.length > 1) out.push("heat");
  if (p.year && p.year.length > 1) out.push("year");
  if (!out.length) out.push("ghost");
  return out;
}

interface Racer {
  lane: number; // 0-based
  total: number;
  me: boolean;
  ghost: boolean;
  tag?: string;
}

export const replayScene = (p: ReplayParams, mode: ReplayMode = "ghost"): SceneFactory => (st) => {
  const cap = capOf(p.cap);
  let racers: Racer[];
  let lanes: number;
  if (mode === "heat" && p.heat && p.heat.length > 1) {
    lanes = Math.max(8, ...p.heat.map((r) => r.lane));
    racers = p.heat.map((r) => ({ lane: r.lane - 1, total: r.time, me: r.me, ghost: false, tag: r.me ? undefined : String(r.year) }));
  } else if (mode === "year" && p.year && p.year.length > 1) {
    lanes = p.year.length;
    let meIdx = p.year.indexOf(p.me);
    if (meIdx < 0) meIdx = Math.max(0, p.year.findIndex((t) => t >= p.me));
    racers = p.year.map((t, i) => ({ lane: i, total: t, me: i === meIdx, ghost: false }));
  } else {
    lanes = Math.max(8, (p.lane ?? 4) + (p.lane === 8 ? 0 : 1));
    const myLane = clamp((p.lane ?? 4) - 1, 0, lanes - 1);
    racers = [{ lane: myLane, total: p.me, me: true, ghost: false }];
    if (p.ghost != null) racers.push({ lane: myLane + 1 < lanes ? myLane + 1 : myLane - 1, total: p.ghost, me: false, ghost: true });
  }
  const meRacer = racers.find((r) => r.me) ?? racers[0];
  const total = Math.max(...racers.map((r) => r.total));
  const speed = total < 70_000 ? 4 : total < 150_000 ? 8 : 12;
  const lead = 450;
  const end = lead + total / speed + 2600;
  const X0 = 26;
  const X1 = 380;
  const Y0 = 54;
  const LANE = Math.min(28, 214 / lanes);
  const compact = LANE < 12;
  const mx = (m: number) => X0 + ((X1 - X0) * m) / p.pool;
  const flagM = 5;
  const sorted = [...racers].filter((r) => !r.ghost).sort((a, b) => a.total - b.total);
  const placeOf = (r: Racer) => sorted.indexOf(r) + 1;
  const state = { t: 0, party: false };

  const swimmer = (c: CanvasRenderingContext2D, x: number, y: number, dir: number, ph: number, r: Racer) => {
    const s = r.me ? clamp(LANE / 26, 0.62, 1) : clamp(LANE / 26, 0.35, 1);
    if (compact && !r.me) {
      c.fillStyle = "rgba(255,255,255,.9)";
      c.beginPath();
      c.arc(x, y, Math.max(1.6, LANE * 0.36), 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.save();
    c.translate(x, y);
    c.scale(dir * s, s);
    const other = !r.me;
    c.globalAlpha = r.ghost ? 0.5 : 1;
    const arm = Math.sin(ph) * 5;
    c.strokeStyle = r.ghost ? "#ffffff" : "#f3c6a5";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(2, -3);
    c.lineTo(8 + arm, -8);
    c.moveTo(2, 3);
    c.lineTo(8 - arm, 8);
    c.stroke();
    c.fillStyle = r.ghost ? "#ffffff" : other ? "#3d5566" : "#2244b0";
    c.beginPath();
    c.ellipse(-4, 0, 9, 4.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = r.ghost ? "#ffffff" : other ? "#dfe8ed" : cap.base;
    c.beginPath();
    c.arc(7, 0, 4.4, 0, Math.PI * 2);
    c.fill();
    if (r.me && cap.split) {
      c.fillStyle = cap.split;
      c.beginPath();
      c.arc(7, 0, 4.4, -Math.PI / 2, Math.PI / 2);
      c.fill();
    }
    c.strokeStyle = r.ghost ? "#ffffff" : "#f3c6a5";
    c.beginPath();
    c.moveTo(-12, -2);
    c.lineTo(-18 - Math.sin(ph * 2) * 2, -3);
    c.moveTo(-12, 2);
    c.lineTo(-18 + Math.sin(ph * 2) * 2, 3);
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  };

  const poolArt = (c: CanvasRenderingContext2D) => {
    c.fillStyle = "#e9f6fa";
    c.fillRect(0, 0, 400, 300);
    c.fillStyle = "#0a2231";
    c.beginPath();
    c.roundRect(10, 8, 380, 36, 10);
    c.fill();
    const h = LANE * lanes;
    const wg = c.createLinearGradient(0, Y0, 0, Y0 + h);
    wg.addColorStop(0, "#38bfe2");
    wg.addColorStop(1, "#1a97c4");
    c.fillStyle = wg;
    c.fillRect(X0, Y0, X1 - X0, h);
    if (!compact) {
      c.fillStyle = "rgba(6,50,74,.35)";
      for (let i = 0; i < lanes; i++) {
        const cy = Y0 + LANE * i + LANE / 2;
        c.fillRect(mx(2), cy - 1.5, mx(p.pool - 2) - mx(2), 3);
        c.fillRect(mx(2) - 1.5, cy - 6, 3, 12);
        c.fillRect(mx(p.pool - 2) - 1.5, cy - 6, 3, 12);
      }
    }
    c.strokeStyle = "rgba(255,255,255,.55)";
    c.setLineDash([3, 4]);
    c.lineWidth = 1;
    for (const m of [flagM, p.pool - flagM]) {
      c.beginPath();
      c.moveTo(mx(m), Y0 - 2);
      c.lineTo(mx(m), Y0 + h + 2);
      c.stroke();
    }
    c.setLineDash([]);
    c.fillStyle = "rgba(255,224,122,.3)";
    c.fillRect(X0, Y0 + LANE * meRacer.lane, X1 - X0, LANE);
    for (let i = 1; i < lanes; i++) {
      const y = Y0 + LANE * i;
      if (compact) {
        c.strokeStyle = "rgba(255,255,255,.28)";
        c.beginPath();
        c.moveTo(X0, y);
        c.lineTo(X1, y);
        c.stroke();
        continue;
      }
      const stepM = p.pool / 40;
      for (let m = stepM / 2, j = 0; m < p.pool; m += stepM, j++) {
        const nearWall = m < flagM || m > p.pool - flagM;
        c.fillStyle = nearWall ? "#e8504a" : j % 2 ? "#ffffff" : "#1f6fe5";
        c.beginPath();
        c.ellipse(mx(m), y, 2.6, 2, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (!compact) {
      c.font = "700 9px Lexend, system-ui, sans-serif";
      c.textAlign = "center";
      for (let i = 0; i < lanes; i++) {
        const cy = Y0 + LANE * i + LANE / 2;
        c.fillStyle = i === meRacer.lane ? "#ffd23f" : "#d7e9ef";
        c.fillRect(8, cy - Math.min(8, LANE / 2 - 1), 15, Math.min(16, LANE - 2));
        c.fillStyle = "#0a2231";
        c.fillText(String(i + 1), 15.5, cy + 3);
      }
    }
    c.fillStyle = "#3a5f70";
    c.font = "500 8px Lexend, system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(`${flagM} m`, mx(flagM) + 3, Y0 + h + 10);
    c.textAlign = "right";
    c.fillText(`${p.pool} m`, X1, Y0 + h + 10);
  };

  return {
    end,
    rest: end,
    paintsCanvas: true,
    update(t, _k, still) {
      state.t = t;
      if (!still && !state.party && t > lead + meRacer.total / speed + 300) {
        state.party = true;
        const lengths = Math.round(p.distance / p.pool);
        const wallX = lengths % 2 === 0 ? mx(0) : mx(p.pool);
        for (let i = 0; i < 12; i++) {
          st.parts.add({ kind: "spark", x: wallX + rnd(-6, 26), y: Y0 + LANE * meRacer.lane + LANE / 2 + rnd(-14, 14), vx: rnd(-0.3, 0.3), vy: rnd(-0.5, 0.1), g: 0, size: rnd(2.5, 5), color: "#ffe08a", decay: 0.012 });
        }
      }
    },
    draw() {
      const c = st.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, st.canvas.width, st.canvas.height);
      c.setTransform(st.k, 0, 0, st.k, 0, 0);
      poolArt(c);
      const raceMs = Math.max(0, (state.t - lead) * speed);
      // others first, Viki on top
      for (const r of [...racers].sort((a, b) => Number(a.me) - Number(b.me))) {
        const d = distanceAt(raceMs, r.total, p.distance, p.pool);
        const { m, dir } = positionAt(d, p.pool);
        const y = Y0 + LANE * r.lane + LANE / 2;
        swimmer(c, mx(m), y, dir, raceMs / 180 + r.lane, r);
        const finished = raceMs >= r.total;
        if (r.tag && !compact && !finished) {
          c.fillStyle = "rgba(10,34,49,.55)";
          c.font = "600 7.5px Lexend, system-ui, sans-serif";
          c.textAlign = "right";
          c.fillText(r.tag, X1 - 4, y + 3);
        }
        if (finished && (!compact || r.me)) {
          const atStart = m < p.pool / 2;
          c.textAlign = atStart ? "left" : "right";
          const x = atStart ? mx(0) + 30 : mx(p.pool) - 30;
          if (r.me) {
            c.fillStyle = "#ffd23f";
            c.font = "800 9px Lexend, system-ui, sans-serif";
            c.fillText(mode === "ghost" ? fmtRace(r.total) : `${placeOf(r)}. · ${fmtRace(r.total)}`, x, y + 3);
          } else if (r.ghost) {
            c.fillStyle = "rgba(255,255,255,.9)";
            c.font = "700 9px Lexend, system-ui, sans-serif";
            c.fillText(fmtRace(r.total), x, y + 3);
          } else {
            c.fillStyle = "rgba(255,255,255,.85)";
            c.font = "700 8px Lexend, system-ui, sans-serif";
            c.fillText(`${placeOf(r)}.`, x, y + 3);
          }
        }
      }
      // clock + legend
      c.fillStyle = "#ffffff";
      c.font = "800 20px Bricolage Grotesque, Lexend, system-ui, sans-serif";
      c.textAlign = "left";
      c.fillText(fmtRace(Math.min(raceMs, total)), 22, 33);
      c.font = "600 9px Lexend, system-ui, sans-serif";
      c.fillStyle = "#ffd23f";
      c.fillText(`● ${p.meLabel}`, 120, 23);
      c.fillStyle = "rgba(255,255,255,.75)";
      const legend =
        mode === "heat"
          ? `rozplavba ${p.heatNo ?? ""} · ${racers.length} plavkyň`
          : mode === "year"
            ? `ročník ${p.birthYear ?? ""} · ${racers.length} plavkyň`
            : p.ghost != null && p.ghostLabel
              ? `○ ${p.ghostLabel} · ${fmtRace(p.ghost)}`
              : "";
      if (legend) c.fillText(legend, 120, 36);
      c.fillStyle = "#7fd7ef";
      c.textAlign = "right";
      c.fillText(`${p.title} · ×${speed}`, 382, 23);
      if (raceMs >= total + 300) {
        const n = sorted.length;
        const k = placeOf(meRacer);
        const msg =
          mode === "heat"
            ? `v rozplavbě ${k}. z ${n}`
            : mode === "year"
              ? `v ročníku ${p.birthYear ?? ""}: ${k}. z ${n}`
              : p.ghost == null
                ? "první start na téhle trati!"
                : p.me < p.ghost
                  ? `o ${((p.ghost - p.me) / 1000).toFixed(2).replace(".", ",")} s rychleji než minule!`
                  : `o ${((p.me - p.ghost) / 1000).toFixed(2).replace(".", ",")} s pomaleji, příště!`;
        c.globalAlpha = clamp((raceMs - total - 300) / (1200 * speed), 0, 1);
        c.fillStyle = "#0a2231";
        c.beginPath();
        c.roundRect(92, 270, 216, 24, 12);
        c.fill();
        c.fillStyle = "#ffd23f";
        c.font = "800 12px Lexend, system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText(msg, 200, 286);
        c.globalAlpha = 1;
      }
      st.parts.draw(c);
    },
  } satisfies Scene;
};
