// "Závod znovu": a race replayed from above, against the ghost of the previous record.
// Pacing is modelled (first length a bit faster after the dive); CSPS has no per-length splits for kids' races.
import { E, clamp, rnd, type Scene, type SceneFactory } from "./engine";
import { capOf, type CapKey } from "./look";

export interface ReplayParams {
  title: string; // "50 m prsa"
  distance: number; // metres
  pool: 25 | 50;
  me: number; // ms
  meLabel: string; // "Viki · 13. 6."
  ghost: number | null; // previous record, ms
  ghostLabel: string | null; // "rekord 28. 3."
  lane: number | null; // her lane, when known
  cap?: CapKey; // her chosen cap, also on the replay swimmer
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
  return pool + (ms - first) / rest * pool;
}

// x position (in metres from the start wall) and heading for a distance into the race
export function positionAt(d: number, pool: number): { m: number; dir: 1 | -1 } {
  const length = Math.min(Math.floor(d / pool), Math.max(0, Math.ceil(d / pool) - 1));
  const into = d - length * pool;
  return length % 2 === 0 ? { m: into, dir: 1 } : { m: pool - into, dir: -1 };
}

export const replayScene = (p: ReplayParams): SceneFactory => (st) => {
  const total = Math.max(p.me, p.ghost ?? 0);
  const speed = total < 70_000 ? 4 : total < 150_000 ? 8 : 12;
  const lead = 450; // ms before the start beep
  const end = lead + total / speed + 2600;
  const lanes = Math.max(8, (p.lane ?? 4) + (p.lane === 8 ? 0 : 1));
  const myLane = clamp((p.lane ?? 4) - 1, 0, lanes - 1);
  const ghostLane = p.ghost == null ? -1 : myLane + 1 < lanes ? myLane + 1 : myLane - 1;
  const X0 = 26;
  const X1 = 380;
  const Y0 = 54;
  const LANE = Math.min(28, 214 / lanes);
  const mx = (m: number) => X0 + ((X1 - X0) * m) / p.pool;
  const flagM = 5;
  const state = { t: 0, party: false };
  const cap = capOf(p.cap);

  const swimmer = (c: CanvasRenderingContext2D, x: number, y: number, dir: number, ph: number, ghost: boolean) => {
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    c.globalAlpha = ghost ? 0.5 : 1;
    const arm = Math.sin(ph) * 5;
    c.strokeStyle = ghost ? "#ffffff" : "#f3c6a5";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(2, -3);
    c.lineTo(8 + arm, -8);
    c.moveTo(2, 3);
    c.lineTo(8 - arm, 8);
    c.stroke();
    c.fillStyle = ghost ? "#ffffff" : "#0b3a5a";
    c.beginPath();
    c.ellipse(-4, 0, 9, 4.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = ghost ? "#ffffff" : cap.base;
    c.beginPath();
    c.arc(7, 0, 4.4, 0, Math.PI * 2);
    c.fill();
    if (!ghost && cap.split) {
      c.fillStyle = cap.split;
      c.beginPath();
      c.arc(7, 0, 4.4, -Math.PI / 2, Math.PI / 2);
      c.fill();
    }
    c.strokeStyle = ghost ? "#ffffff" : "#f3c6a5";
    c.beginPath();
    c.moveTo(-12, -2);
    c.lineTo(-18 - Math.sin(ph * 2) * 2, -3);
    c.moveTo(-12, 2);
    c.lineTo(-18 + Math.sin(ph * 2) * 2, 3);
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  };

  const pool = (c: CanvasRenderingContext2D) => {
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
    // lane T-lines on the pool floor, 2 m short of each wall
    const tEnd = p.pool === 25 ? 2 : 2;
    c.fillStyle = "rgba(6,50,74,.35)";
    for (let i = 0; i < lanes; i++) {
      const cy = Y0 + LANE * i + LANE / 2;
      c.fillRect(mx(tEnd), cy - 1.5, mx(p.pool - tEnd) - mx(tEnd), 3);
      c.fillRect(mx(tEnd) - 1.5, cy - 6, 3, 12);
      c.fillRect(mx(p.pool - tEnd) - 1.5, cy - 6, 3, 12);
    }
    // backstroke flags 5 m from each wall, 15 m marks in a long pool
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
    // her lane
    c.fillStyle = "rgba(255,224,122,.24)";
    c.fillRect(X0, Y0 + LANE * myLane, X1 - X0, LANE);
    // lane ropes: red near the walls, blue/white between
    for (let i = 1; i < lanes; i++) {
      const y = Y0 + LANE * i;
      const stepM = p.pool / 40;
      for (let m = stepM / 2, j = 0; m < p.pool; m += stepM, j++) {
        const end = m < flagM || m > p.pool - flagM;
        c.fillStyle = end ? "#e8504a" : j % 2 ? "#ffffff" : "#1f6fe5";
        c.beginPath();
        c.ellipse(mx(m), y, 2.6, 2, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    // starting blocks with lane numbers
    c.font = "700 9px Lexend, system-ui, sans-serif";
    c.textAlign = "center";
    for (let i = 0; i < lanes; i++) {
      const cy = Y0 + LANE * i + LANE / 2;
      c.fillStyle = i === myLane ? "#ffd23f" : "#d7e9ef";
      c.fillRect(8, cy - 8, 15, 16);
      c.fillStyle = "#0a2231";
      c.fillText(String(i + 1), 15.5, cy + 3);
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
      if (!still && !state.party && t > lead + p.me / speed + 300) {
        state.party = true;
        const beat = p.ghost != null && p.me < p.ghost;
        const lengths = Math.round(p.distance / p.pool);
        const wallX = lengths % 2 === 0 ? mx(0) : mx(p.pool);
        for (let i = 0; i < (beat ? 16 : 8); i++) {
          st.parts.add({ kind: "spark", x: wallX + rnd(-6, 26), y: Y0 + LANE * myLane + LANE / 2 + rnd(-14, 14), vx: rnd(-0.3, 0.3), vy: rnd(-0.5, 0.1), g: 0, size: rnd(2.5, 5), color: "#ffe08a", decay: 0.012 });
        }
      }
    },
    draw() {
      const c = st.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, st.canvas.width, st.canvas.height);
      c.setTransform(st.k, 0, 0, st.k, 0, 0);
      pool(c);
      const raceMs = Math.max(0, (state.t - lead) * speed);
      const racers = [
        { total: p.me, lane: myLane, ghost: false },
        ...(p.ghost != null ? [{ total: p.ghost, lane: ghostLane, ghost: true }] : []),
      ];
      for (const r of racers) {
        const d = distanceAt(raceMs, r.total, p.distance, p.pool);
        const { m, dir } = positionAt(d, p.pool);
        const y = Y0 + LANE * r.lane + LANE / 2;
        swimmer(c, mx(m), y, dir, raceMs / 180, r.ghost);
        if (raceMs >= r.total) {
          c.fillStyle = r.ghost ? "rgba(255,255,255,.9)" : "#ffd23f";
          c.font = "700 9px Lexend, system-ui, sans-serif";
          const atStart = m < p.pool / 2;
          c.textAlign = atStart ? "left" : "right";
          c.fillText(fmtRace(r.total), atStart ? mx(0) + 36 : mx(p.pool) - 36, y + 3);
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
      if (p.ghost != null && p.ghostLabel) {
        c.fillStyle = "rgba(255,255,255,.75)";
        c.fillText(`○ ${p.ghostLabel} · ${fmtRace(p.ghost)}`, 120, 36);
      }
      c.fillStyle = "#7fd7ef";
      c.textAlign = "right";
      c.fillText(`${p.title} · ×${speed}`, 382, 23);
      if (raceMs >= total + 300) {
        const msg =
          p.ghost == null
            ? "první start na téhle trati!"
            : p.me < p.ghost
              ? `o ${((p.ghost - p.me) / 1000).toFixed(2).replace(".", ",")} s rychleji než minule!`
              : `o ${((p.me - p.ghost) / 1000).toFixed(2).replace(".", ",")} s pomaleji, příště!`;
        c.globalAlpha = clamp((raceMs - total - 300) / (1200 * speed), 0, 1);
        c.fillStyle = "#0a2231";
        c.beginPath();
        c.roundRect(92, 266, 216, 26, 13);
        c.fill();
        c.fillStyle = "#ffd23f";
        c.font = "800 12px Lexend, system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText(msg, 200, 283);
        c.globalAlpha = 1;
      }
      st.parts.draw(c);
    },
  } satisfies Scene;
};
