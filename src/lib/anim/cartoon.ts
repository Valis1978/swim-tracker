// Cartoon swimmer scenes (side view of the pool): dive from the block, personal best at the wall,
// reserve -> into the race, medal. Each scene runs once and holds its last frame.
import { E, S, Stage, T, f2, lerp, once, rnd, seg, uidOf, Water, type Scene, type SceneFactory } from "./engine";
import { CAP_FRONT_HALF, CAP_PATH, CAP_SEAM, CLUB_BLUE, CLUB_BLUE_DARK, CLUB_CYAN, capOf, type CapStyle, type Look } from "./look";

const C = {
  ink: "#08324a",
  skin: "#f3c6a5",
  skin2: "#dda483",
  suit: CLUB_BLUE_DARK,
  stripe: CLUB_CYAN,
  lens: "#0b3a5a",
  red: "#e8504a",
  blue: "#1f6fe5",
  white: "#ffffff",
  gold: "#ffc23d",
};
const CONFETTI = ["#ffc23d", "#e8504a", "#ffffff", "#2cb5da", "#1f6fe5", "#0f9d74"];
const FONT = "Lexend, system-ui, sans-serif";
const SCALE = 1.3;

function grad(defs: Element, stops: [number, string, number?][]) {
  const id = uidOf("g");
  const g = S("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  for (const [o, c, a] of stops) S("stop", { offset: o, "stop-color": c, "stop-opacity": a ?? 1 }, g);
  return `url(#${id})`;
}

interface Pool {
  actors: Element;
  top: Element;
  draw(t: number): void;
}

function hallBackdrop(svg: Element, defs: Element, flags: boolean) {
  const hall = grad(defs, [[0, "#e9f8fc"], [1, "#c5ebf6"]]);
  S("rect", { x: 0, y: 0, width: 400, height: 300, fill: hall }, svg);
  for (let i = 0; i < 4; i++) S("rect", { x: 22 + i * 98, y: 14, width: 70, height: 30, rx: 7, fill: "#ffffff", opacity: 0.6 }, svg);
  if (flags) {
    // backstroke flags, 5 m from the wall
    const g = S("g", undefined, svg);
    S("path", { d: "M-5,60 Q200,70 405,60", stroke: C.ink, "stroke-width": 1, fill: "none", opacity: 0.45 }, g);
    const cols = [C.red, C.white, C.blue];
    for (let x = 8, i = 0; x < 400; x += 21, i++) {
      const y = 60 + 10 * (1 - Math.pow((x - 200) / 205, 2)) - 0.2;
      S("path", { d: `M${x - 6},${f2(y)} L${x + 6},${f2(y)} L${x},${f2(y + 11)} Z`, fill: cols[i % 3], stroke: C.ink, "stroke-width": 0.8, "stroke-linejoin": "round" }, g);
    }
  }
}

// pool hall + water; wallL / wallR mark deck walls
function cartoonPool(st: Stage, { y0 = 172, wallL = 0, wallR = 400, flags = true } = {}): Pool {
  const svg = st.svg;
  const defs = S("defs", undefined, svg);
  const deep = grad(defs, [[0, "#62d3ec"], [0.35, "#22a9d3"], [1, "#0b6f98"]]);
  const front = grad(defs, [[0, "#bff0fb", 0.55], [0.25, "#7fdcf1", 0.22], [1, "#0b6f98", 0.18]]);
  hallBackdrop(svg, defs, flags);
  st.water = new Water(y0, wallL, wallR);
  const back = S("path", { fill: deep }, svg);
  const under = S("g", undefined, svg);
  for (let x = wallL + 10; x < wallR; x += 22) S("line", { x1: x, y1: y0 + 24, x2: x, y2: 300, stroke: "#ffffff", "stroke-opacity": 0.1, "stroke-width": 1 }, under);
  for (let y = y0 + 34; y < 300; y += 22) S("line", { x1: wallL, y1: y, x2: wallR, y2: y, stroke: "#ffffff", "stroke-opacity": 0.1, "stroke-width": 1 }, under);
  S("rect", { x: wallL + 26, y: 281, width: Math.max(0, wallR - wallL - 52), height: 8, rx: 2, fill: "#06324a", opacity: 0.55 }, under);
  const caust = S("g", { opacity: 0.35 }, svg);
  const c1 = S("path", { d: "M-40,212 C10,202 40,222 90,212 S170,202 220,214 S300,222 350,210 S420,204 460,212", stroke: "#e9fbff", "stroke-width": 1.6, fill: "none" }, caust);
  const c2 = S("path", { d: "M-40,246 C0,238 50,256 100,246 S180,236 230,248 S320,256 360,244 S430,240 470,246", stroke: "#e9fbff", "stroke-width": 1.2, fill: "none" }, caust);
  // the far lane rope sits behind the swimmer
  const rope = S("g", undefined, svg);
  const floats: { x: number; el: Element }[] = [];
  for (let x = wallL + 6; x <= wallR - 6; x += 13) {
    const i = floats.length;
    const fill = x < wallL + 66 || x > wallR - 66 ? C.red : i % 2 ? C.white : C.blue;
    floats.push({ x, el: S("ellipse", { rx: 5.6, ry: 3.3, stroke: C.ink, "stroke-width": 1, fill }, rope) });
  }
  const actors = S("g", undefined, svg);
  const frontPath = S("path", { fill: front }, svg);
  const surf = S("path", { fill: "none", stroke: "#ffffff", "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.95 }, svg);
  const top = S("g", undefined, svg);
  return {
    actors,
    top,
    draw(t: number) {
      const w = st.water!;
      back.setAttribute("d", w.body());
      frontPath.setAttribute("d", w.body());
      surf.setAttribute("d", w.surface());
      for (const fl of floats) fl.el.setAttribute("transform", `translate(${f2(fl.x)} ${f2(w.y(fl.x) + 0.5)}) rotate(${f2(Math.atan(w.slope(fl.x)) * 57.3)})`);
      const s = t / 1000;
      c1.setAttribute("transform", `translate(${f2(Math.sin(s * 0.7) * 14)} 0)`);
      c2.setAttribute("transform", `translate(${f2(Math.cos(s * 0.55) * 18)} 0)`);
    },
  };
}

function deckWall(st: Stage, before: Element, x: number, y: number, w: number) {
  const g = S("g", undefined, st.svg);
  S("rect", { x, y, width: w, height: 310 - y, fill: "#e3f2f7", stroke: C.ink, "stroke-width": 1.6 }, g);
  for (let yy = y + 16; yy < 300; yy += 16) S("line", { x1: x, y1: yy, x2: x + w, y2: yy, stroke: C.ink, "stroke-opacity": 0.12 }, g);
  st.svg.insertBefore(g, before);
  return g;
}

function startingBlock(parent: Element, x: number, topY: number, num: string) {
  const g = S("g", undefined, parent);
  S("rect", { x: x + 14, y: topY + 4, width: 16, height: 40, fill: "#2b4b5e", stroke: C.ink, "stroke-width": 1.6 }, g);
  S("path", { d: `M${x - 6},${topY + 7} L${x + 62},${topY} L${x + 62},${topY + 8} L${x - 6},${topY + 14} Z`, fill: "#eef5f8", stroke: C.ink, "stroke-width": 1.8, "stroke-linejoin": "round" }, g);
  const plate = S("rect", { x: x + 10, y: topY + 16, width: 24, height: 18, rx: 4, fill: C.red, stroke: C.ink, "stroke-width": 1.4 }, g);
  const txt = S("text", { x: x + 22, y: topY + 30, "text-anchor": "middle", "font-size": num.length > 1 ? 11 : 13, "font-weight": 800, fill: "#fff", "font-family": FONT }, g);
  txt.textContent = num;
  const lamp = S("circle", { cx: x + 40, cy: topY + 22, r: 3.4, fill: "#5a6b75", stroke: C.ink, "stroke-width": 1 }, g);
  return { g, plate, lamp };
}

// a small mark in the spirit of the club logo (not the logo itself)
function clubMark(parent: Element, x: number, y: number, s: number, color = CLUB_BLUE, dot = CLUB_CYAN) {
  const m = S("g", { transform: `translate(${x} ${y}) rotate(20) scale(${s})` }, parent);
  S("path", { d: "M-6,-6 L6,6 M6,-6 L-6,6", stroke: color, "stroke-width": 3.6, "stroke-linecap": "round", fill: "none" }, m);
  S("circle", { cx: 7.5, cy: -8.5, r: 2.8, fill: dot }, m);
}

function drawCap(head: Element, cap: CapStyle) {
  const clipId = uidOf("cc");
  S("path", { d: CAP_PATH }, S("clipPath", { id: clipId }, head));
  S("path", { d: CAP_PATH, fill: cap.base }, head);
  if (cap.split) {
    const g = S("g", { "clip-path": `url(#${clipId})` }, head);
    S("path", { d: CAP_FRONT_HALF, fill: cap.split }, g);
    S("path", { d: CAP_SEAM, stroke: C.ink, "stroke-width": 0.9, opacity: 0.45, fill: "none" }, g);
    if (cap.mark) clubMark(g, 4.6, -4.4, 0.36);
  }
  S("path", { d: CAP_PATH, fill: "none", stroke: C.ink, "stroke-width": 1.8, "stroke-linejoin": "round" }, head);
  if (!cap.split) S("path", { d: "M3.6,-6.4 A7.6,7.6 0 0 1 7.1,-2.6", stroke: cap.hi, "stroke-width": 2, "stroke-linecap": "round", fill: "none" }, head);
}

interface Pose {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  armF: number;
  armB: number;
  legF: number;
  legB: number;
  head: number;
  hoodie: number; // 0 = swimsuit, 1 = club hoodie and shorts on
  tee: number; // 1 = club T-shirt and shorts on
}

// cartoon swimmer facing right; body axis along +x (head end), origin at the hips
function cartoonSwimmer(parent: Element, look: Look) {
  const g = S("g", undefined, parent);
  const longSleeves: Element[] = []; // hoodie
  const shortSleeves: Element[] = []; // T-shirt
  const shorts: Element[] = []; // club shorts with either top
  const limb = (len: number, w: number, fill: string, end: "hand" | "foot") => {
    const lg = S("g", undefined, g);
    S("rect", { x: -w / 2, y: -w / 2, width: len + w / 2, height: w, rx: w / 2, fill, stroke: C.ink, "stroke-width": 1.6 }, lg);
    if (end === "hand") {
      S("circle", { cx: len, cy: 0, r: w * 0.66, fill, stroke: C.ink, "stroke-width": 1.5 }, lg);
      longSleeves.push(S("rect", { x: -w / 2 - 1, y: -w / 2 - 1, width: 17 + w / 2 + 1, height: w + 2, rx: (w + 2) / 2, fill: CLUB_BLUE, stroke: C.ink, "stroke-width": 1.5, opacity: 0 }, lg));
      const sh = S("g", { opacity: 0 }, lg);
      S("rect", { x: -w / 2 - 1.5, y: -w / 2 - 1.5, width: 8 + w / 2 + 1.5, height: w + 3, rx: (w + 3) / 2, fill: "#ffffff", stroke: C.ink, "stroke-width": 1.5 }, sh);
      S("rect", { x: 5, y: -w / 2 - 0.8, width: 2.4, height: w + 1.6, fill: CLUB_CYAN }, sh);
      shortSleeves.push(sh);
    } else {
      S("ellipse", { cx: len + 2.5, cy: 0, rx: w * 0.78, ry: w * 0.5, fill, stroke: C.ink, "stroke-width": 1.5 }, lg);
      shorts.push(S("rect", { x: -w / 2 - 1, y: -w / 2 - 1, width: 11 + w / 2 + 1, height: w + 2, rx: (w + 2) / 2, fill: CLUB_BLUE, stroke: C.ink, "stroke-width": 1.5, opacity: 0 }, lg));
    }
    return lg;
  };
  const legB = limb(27, 9, C.skin2, "foot");
  const armB = limb(23, 7, C.skin2, "hand");
  const torso = S("g", undefined, g);
  S("rect", { x: -8, y: -8.5, width: 37, height: 17, rx: 8.5, fill: C.suit, stroke: C.ink, "stroke-width": 1.8 }, torso);
  S("path", { d: "M-2,-1.5 L22,-1.5", stroke: C.stripe, "stroke-width": 3.2, "stroke-linecap": "round" }, torso);
  // club T-shirt: white with the blue / cyan swoosh from the club shirts
  const tee = S("g", { opacity: 0 }, torso);
  S("rect", { x: -9.5, y: -9.8, width: 39, height: 19.6, rx: 9.8, fill: "#ffffff", stroke: C.ink, "stroke-width": 1.8 }, tee);
  S("path", { d: "M-4,6.5 C4,-1.5 14,-3.5 26,-0.5", stroke: CLUB_BLUE, "stroke-width": 3.4, "stroke-linecap": "round", fill: "none" }, tee);
  S("path", { d: "M2,8.2 C10,3.6 18,2.6 24,4.2", stroke: CLUB_CYAN, "stroke-width": 2.2, "stroke-linecap": "round", fill: "none" }, tee);
  clubMark(tee, 18, -3.8, 0.3, CLUB_BLUE, CLUB_CYAN);
  const hoodie = S("g", { opacity: 0 }, torso);
  S("ellipse", { cx: 28, cy: -9, rx: 7, ry: 5, fill: CLUB_BLUE_DARK, stroke: C.ink, "stroke-width": 1.5 }, hoodie);
  S("rect", { x: -10, y: -10.5, width: 40, height: 21, rx: 10.5, fill: CLUB_BLUE, stroke: C.ink, "stroke-width": 1.8 }, hoodie);
  clubMark(hoodie, 13, 3.5, 0.5, "#ffffff", CLUB_CYAN);
  const legF = limb(27, 9, C.skin, "foot");
  const head = S("g", undefined, g);
  S("circle", { cx: 0, cy: 0, r: 10.5, fill: C.skin, stroke: C.ink, "stroke-width": 1.8 }, head);
  // the cap covers the top and back of the head (the face looks towards +y in body space)
  drawCap(head, capOf(look.cap));
  S("path", { d: "M9.9,3.2 A10.4,10.4 0 0 0 -5,-9.1", stroke: C.ink, "stroke-width": 1.5, fill: "none", opacity: 0.9 }, head);
  S("ellipse", { cx: 4.4, cy: 6.4, rx: 3.9, ry: 2.8, transform: "rotate(-30 4.4 6.4)", fill: C.lens, stroke: C.ink, "stroke-width": 1.2 }, head);
  S("circle", { cx: 5.6, cy: 5.6, r: 1, fill: "#bff3ff" }, head);
  S("path", { d: "M-4.4,4.6 Q-3.6,7.6 -0.8,7.9", stroke: C.ink, "stroke-width": 1.4, fill: "none", "stroke-linecap": "round" }, head);
  const armF = limb(23, 7, C.skin, "hand");
  const p: Pose = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, armF: 0, armB: 0, legF: 180, legB: 182, head: 0, hoodie: 0, tee: 0 };
  const api = {
    p,
    set(q: Partial<Pose>) {
      Object.assign(p, q);
      g.setAttribute("transform", T(p.x, p.y, p.rot, p.sx * SCALE, p.sy * SCALE));
      legB.setAttribute("transform", `translate(-3 1.5) rotate(${f2(p.legB)})`);
      legF.setAttribute("transform", `translate(-3 -1.5) rotate(${f2(p.legF)})`);
      armB.setAttribute("transform", `translate(23 -1.5) rotate(${f2(p.armB)})`);
      armF.setAttribute("transform", `translate(23 1.5) rotate(${f2(p.armF)})`);
      head.setAttribute("transform", `translate(39 0) rotate(${f2(p.head)})`);
      hoodie.setAttribute("opacity", f2(p.hoodie));
      tee.setAttribute("opacity", f2(p.tee));
      for (const k of longSleeves) k.setAttribute("opacity", f2(p.hoodie));
      for (const k of shortSleeves) k.setAttribute("opacity", f2(p.tee));
      for (const k of shorts) k.setAttribute("opacity", f2(Math.max(p.hoodie, p.tee)));
    },
    // world position of the leading hand, for splash timing
    hand(): [number, number] {
      const r = (p.rot * Math.PI) / 180;
      const a = ((p.rot + p.armF) * Math.PI) / 180;
      const sx = p.x + Math.cos(r) * 23 * SCALE;
      const sy = p.y + Math.sin(r) * 23 * SCALE;
      return [sx + Math.cos(a) * 27 * SCALE, sy + Math.sin(a) * 27 * SCALE];
    },
  };
  api.set({});
  return api;
}

const READY = { rot: 32, armF: 30, armB: 34, legF: 68, legB: 72, head: -38, sx: 1, sy: 1 };

function freestyle(phase: number) {
  const a = (phase * 360) % 360;
  const kick = Math.sin(phase * Math.PI * 6) * 9;
  return { armF: a, armB: (a + 180) % 360, legF: 180 + kick, legB: 180 - kick };
}

function splashAt(st: Stage, x: number, y: number, n = 26, power = 1) {
  for (let i = 0; i < n; i++) {
    st.parts.add({ x: x + rnd(-6, 6), y: y - 1, vx: rnd(-1.6, 2.6) * power, vy: rnd(-5.4, -2.2) * power, size: rnd(1.2, 3), color: Math.random() < 0.7 ? "#ffffff" : "#bdf1ff", decay: 0.006 });
  }
  st.water?.hit(x, 9 * power, 3);
}
function bubbles(st: Stage, x: number, y: number) {
  st.parts.add({ kind: "bubble", x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-0.2, 0.2), vy: rnd(-0.6, -0.2), size: rnd(1.2, 2.8), color: "#e9fbff", decay: 0.004, alpha: 0.85 });
}
function confetti(st: Stage, x: number, y: number, n = 70) {
  for (let i = 0; i < n; i++) {
    st.parts.add({ kind: "confetti", x: x + rnd(-30, 30), y: y + rnd(-6, 6), vx: rnd(-3.2, 3.2), vy: rnd(-5.5, -1.5), g: 0.09, drag: 0.985, size: rnd(2.2, 3.6), rot: rnd(0, 6), vr: rnd(-0.25, 0.25), color: CONFETTI[i % CONFETTI.length], decay: 0.0045 });
  }
}
function sparkles(st: Stage, x: number, y: number, n = 10, color = "#ffe08a") {
  for (let i = 0; i < n; i++) st.parts.add({ kind: "spark", x: x + rnd(-40, 40), y: y + rnd(-22, 22), vx: rnd(-0.4, 0.4), vy: rnd(-0.6, 0.1), g: 0, size: rnd(2.5, 5), color, decay: 0.012 });
}

// swimming along the surface with splashes at each hand entry
function swimStep(st: Stage, sw: ReturnType<typeof cartoonSwimmer>, s: Record<string, number>, t: number, x: number, y: number, still: boolean) {
  const phase = t / 820;
  sw.set({ x, y: y + Math.sin(phase * Math.PI * 2) * 0.8, rot: 0, ...freestyle(phase), head: Math.sin(phase * Math.PI) * 6, sx: 1, sy: 1 });
  const a = (phase * 360) % 360;
  if (!still && (a > 345 || a < 8 || (a > 165 && a < 188)) && (!s.ls || t - s.ls > 260)) {
    s.ls = t;
    splashAt(st, x + 60, st.water!.y(x + 60), 5, 0.45);
  }
}

// ---- scenes -----------------------------------------------------------------------------------

export interface DiveParams {
  lane: string; // number shown on the starting block
  intro?: "tee"; // race day: she first stands on the block in the club T-shirt and waves
}

export const diveScene = ({ lane, intro }: DiveParams, look: Look): SceneFactory => (st) => {
  const off = intro === "tee" ? 1900 : 0;
  const pool = cartoonPool(st, { y0: 172, wallL: 44 });
  deckWall(st, pool.actors, -2, 170, 46);
  const block = startingBlock(pool.actors, 10, 137, lane);
  const sw = cartoonSwimmer(pool.actors, look);
  const beep = S("text", { x: 57, y: 166, "font-size": 11, "font-weight": 800, fill: C.red, stroke: "#ffffff", "stroke-width": 3, "paint-order": "stroke", "font-family": FONT, opacity: 0 }, pool.top);
  beep.textContent = "PÍP!";
  const s: Record<string, boolean> = {};
  const n: Record<string, number> = {};
  return {
    end: 6200 + off,
    rest: off ? 700 : 400,
    update(tAll, _k, still) {
      if (tAll < off) {
        // race day: on the block in the club T-shirt, a wave, then the T-shirt comes off
        if (tAll < 1200) {
          const wave = Math.sin(tAll / 150) * 22;
          sw.set({ x: 38, y: 97 - Math.abs(Math.sin(tAll / 300)) * 3, rot: -90, armF: -10 + wave, armB: 172, legF: 178, legB: 182, head: 0, tee: 1, hoodie: 0, sx: 1, sy: 1 });
        } else {
          const u = E.inOut(seg(tAll, 1250, off));
          sw.set({ tee: 1 - seg(tAll, 1200, 1350), x: 38, y: lerp(97, 98, u), rot: lerp(-90, 32, u), armF: lerp(150, 30, u), armB: lerp(172, 34, u), legF: lerp(178, 68, u), legB: lerp(182, 72, u), head: lerp(0, -38, u), hoodie: 0, sx: 1, sy: 1 });
        }
        once(s, "teeoff", !still && tAll >= 1200, () => {
          sparkles(st, 44, 70, 8, "#ffffff");
          sparkles(st, 44, 70, 8, CLUB_CYAN);
        });
        return;
      }
      const t = tAll - off;
      if (t < 1000) {
        const crouch = E.inOut(seg(t, 600, 1000));
        sw.set({ ...READY, x: 38 - 4 * crouch, y: 98 + 4 * crouch + Math.sin(t / 260) * 0.6 * (1 - crouch), rot: 32 + 4 * crouch });
      } else if (t < 1700) {
        const u = seg(t, 1000, 1700);
        const stretch = Math.sin(Math.PI * seg(u, 0, 0.7)) * 0.06;
        sw.set({
          x: lerp(34, 186, u),
          y: lerp(102, 166, u) - 30 * 4 * u * (1 - u),
          rot: lerp(8, 46, E.inOut(u)),
          armF: lerp(30, -2, E.out(seg(u, 0, 0.3))),
          armB: lerp(34, 3, E.out(seg(u, 0, 0.3))),
          legF: lerp(110, 178, E.out(seg(u, 0, 0.35))),
          legB: lerp(118, 183, E.out(seg(u, 0, 0.35))),
          head: lerp(-38, 0, seg(u, 0, 0.3)),
          sx: 1 + stretch,
          sy: 1 - stretch,
        });
      } else if (t < 2550) {
        const v = E.out(seg(t, 1700, 2550));
        const x = (1 - v) * (1 - v) * 186 + 2 * (1 - v) * v * 245 + v * v * 292;
        const y = (1 - v) * (1 - v) * 166 + 2 * (1 - v) * v * 214 + v * v * 186;
        const dl = Math.sin(t / 85) * 12;
        sw.set({ x, y, rot: lerp(46, -4, E.inOut(seg(t, 1700, 2550))), armF: -2, armB: 3, legF: 180 + dl, legB: 182 + dl, head: 0, sx: 1, sy: 1 });
        if (!still && Math.random() < 0.35) bubbles(st, x + 56, y - 4);
      } else {
        const x = lerp(292, 480, seg(t, 2550, 6000));
        swimStep(st, sw, n, t - 2550, x, lerp(186, 181, E.out(seg(t, 2550, 2900))), still);
        if (!still && Math.random() < 0.18) bubbles(st, x - 20, 188);
      }
      block.lamp.setAttribute("fill", t > 1000 && t < 1600 ? "#3ddc84" : "#5a6b75");
      const pop = seg(t, 1000, 1120);
      beep.setAttribute("opacity", f2(Math.min(pop, 1 - seg(t, 1450, 1750))));
      beep.setAttribute("transform", `translate(70 162) scale(${f2(0.6 + 0.4 * E.back(pop))}) translate(-70 -162)`);
      const hand = sw.hand();
      once(s, "splash", !still && t > 1500 && hand[1] > st.water!.y(hand[0]) - 2, () => splashAt(st, hand[0], st.water!.y(hand[0]), 30, 1.05));
    },
    draw() {
      pool.draw(st.t);
    },
  } satisfies Scene;
};

export interface PbParams {
  label: string; // "50 m PRSA · VIKI"
  time: string; // "57,90"
  banner: string; // "NOVÝ OSOBÁK · −0,45 s"
}

export const pbScene = ({ label, time, banner }: PbParams, look: Look): SceneFactory => (st) => {
  const pool = cartoonPool(st, { y0: 174, wallR: 356, flags: false });
  deckWall(st, pool.actors, 356, 172, 50);
  const pad = S("rect", { x: 351, y: 160, width: 7, height: 44, rx: 2, fill: "#ffd23f", stroke: C.ink, "stroke-width": 1.4 }, pool.actors);
  const glow = S("rect", { x: 340, y: 150, width: 30, height: 64, rx: 14, fill: "#fff3a6", opacity: 0 });
  st.svg.insertBefore(glow, pool.actors);
  const board = S("g", undefined, pool.top);
  S("rect", { x: 12, y: 12, width: 182, height: 74, rx: 12, fill: "#0a2231", stroke: C.ink, "stroke-width": 2 }, board);
  const lbl = S("text", { x: 26, y: 30, "font-size": 10.5, "font-weight": 600, fill: "#7fd7ef", "font-family": FONT }, board);
  lbl.textContent = label;
  const chars = [...time];
  const step = chars.length > 5 ? 23 : 30;
  const size = chars.length > 5 ? 32 : 40;
  const x0 = 103 - (chars.length * step) / 2;
  const cells = chars.map((ch, i) => {
    const tx = S("text", { x: x0 + i * step + step / 2, y: 73, "text-anchor": "middle", "font-size": size, "font-weight": 800, fill: "#fff8d6", "font-family": "Bricolage Grotesque, Lexend, system-ui, sans-serif" }, board);
    tx.textContent = /\d/.test(ch) ? "–" : ch;
    return { tx, ch, stop: 2950 + i * 130 };
  });
  const bannerG = S("g", { opacity: 0 }, pool.top);
  S("rect", { x: 12, y: 94, width: 182, height: 28, rx: 14, fill: C.gold, stroke: C.ink, "stroke-width": 1.8 }, bannerG);
  const bt = S("text", { x: 103, y: 112.5, "text-anchor": "middle", "font-size": banner.length > 22 ? 10.5 : 12, "font-weight": 800, fill: "#4a2c00", "font-family": FONT }, bannerG);
  bt.textContent = banner;
  const sw = cartoonSwimmer(pool.actors, look);
  const s: Record<string, boolean> = {};
  const n: Record<string, number> = {};
  return {
    end: 6200,
    rest: 6200,
    update(t, _k, still) {
      if (t < 2600) {
        swimStep(st, sw, n, t, lerp(-80, 280, t / 2600), 183, still);
      } else if (t < 2900) {
        const u = E.out(seg(t, 2600, 2900));
        const af = sw.p.armF > 180 ? sw.p.armF - 360 : sw.p.armF;
        sw.set({ x: lerp(280, 289, u), y: 183, rot: 0, armF: lerp(af, -6, u), armB: lerp(sw.p.armB, 150, u), legF: 176, legB: 186, head: 0 });
      } else if (t < 3900) {
        sw.set({ x: 289, y: 183 + Math.sin(t / 200) * 0.6, rot: 0, armF: -6, armB: 150, legF: 176 + Math.sin(t / 120) * 6, legB: 186 - Math.sin(t / 120) * 6, head: 0 });
      } else {
        const u = E.back(seg(t, 3900, 4400));
        const wave = t > 4300 ? Math.sin((t - 3900) / 140) * 16 : 0;
        sw.set({ x: lerp(289, 278, u), y: lerp(183, 172, u), rot: lerp(0, -62, u), armF: lerp(-6, -40, u) + wave, armB: lerp(150, 120, u), legF: lerp(176, 150, u) + Math.sin(t / 150) * 8, legB: lerp(186, 160, u) - Math.sin(t / 150) * 8, head: lerp(0, 20, u) });
      }
      once(s, "touch", !still && t >= 2900, () => splashAt(st, 350, st.water!.y(350), 10, 0.6));
      glow.setAttribute("opacity", f2(t > 2900 ? Math.max(0, 0.95 - (t - 2900) / 900) : 0));
      pad.setAttribute("fill", t > 2900 && t < 3300 ? "#fffbd0" : "#ffd23f");
      for (const c of cells) {
        if (!/\d/.test(c.ch)) continue;
        if (t < 2900) c.tx.textContent = "–";
        else if (t < c.stop) c.tx.textContent = still ? c.ch : String(Math.floor(Math.random() * 10));
        else c.tx.textContent = c.ch;
        const b = t >= c.stop ? 1 - E.out(seg(t, c.stop, c.stop + 260)) : 0;
        c.tx.setAttribute("transform", `translate(0 ${f2(-6 * b)})`);
      }
      const bp = seg(t, 3600, 3950);
      bannerG.setAttribute("opacity", f2(Math.min(1, bp * 3)));
      bannerG.setAttribute("transform", `translate(103 108) scale(${f2(Math.max(0.01, E.back(bp)))}) translate(-103 -108)`);
      once(s, "party", !still && t >= 3650, () => {
        confetti(st, 103, 100, 80);
        sparkles(st, 103, 50, 12);
      });
    },
    draw() {
      pool.draw(st.t);
    },
  } satisfies Scene;
};

export interface ReserveParams {
  small: string; // "100 m prsa · Přerov"
  front: string; // "Náhradnice č. 1"
  back: string; // "Rozplavba 8 · dráha 2"
  lane: string;
}

export const reserveScene = ({ small, front, back, lane }: ReserveParams, look: Look): SceneFactory => (st) => {
  const pool = cartoonPool(st, { y0: 206, wallL: 250, flags: false });
  const deck = S("g", undefined, st.svg);
  S("rect", { x: -2, y: 200, width: 254, height: 102, fill: "#e3f2f7", stroke: C.ink, "stroke-width": 1.6 }, deck);
  for (let x = 20; x < 250; x += 26) S("line", { x1: x, y1: 200, x2: x - 14, y2: 300, stroke: C.ink, "stroke-opacity": 0.1 }, deck);
  st.svg.insertBefore(deck, pool.actors);
  const bench = S("g", undefined, pool.actors);
  S("rect", { x: 34, y: 186, width: 7, height: 15, fill: "#c98a4a", stroke: C.ink, "stroke-width": 1.4 }, bench);
  S("rect", { x: 104, y: 186, width: 7, height: 15, fill: "#c98a4a", stroke: C.ink, "stroke-width": 1.4 }, bench);
  S("rect", { x: 24, y: 179, width: 98, height: 9, rx: 3, fill: "#f2b46b", stroke: C.ink, "stroke-width": 1.6 }, bench);
  const block = startingBlock(pool.actors, 218, 168, lane);
  const card = S("g", undefined, pool.top);
  const cardBg = S("rect", { x: 16, y: 16, width: 180, height: 54, rx: 14, stroke: C.ink, "stroke-width": 1.8 }, card);
  const cardSmall = S("text", { x: 106, y: 36, "text-anchor": "middle", "font-size": 11, "font-weight": 600, "font-family": FONT }, card);
  const cardBig = S("text", { x: 106, y: 58, "text-anchor": "middle", "font-size": back.length > 21 ? 14 : 16, "font-weight": 800, "font-family": FONT }, card);
  let flipped = false;
  const setCard = (isFront: boolean) => {
    flipped = !isFront;
    cardBg.setAttribute("fill", isFront ? "#fff1cf" : "#0879a0");
    cardSmall.setAttribute("fill", isFront ? "#8a5300" : "#bfefff");
    cardBig.setAttribute("fill", isFront ? "#6b3f00" : "#ffffff");
    cardSmall.textContent = small;
    cardBig.textContent = isFront ? front : back;
  };
  setCard(true);
  const sw = cartoonSwimmer(pool.actors, look);
  const SIT = { x: 72, y: 172, rot: -90, armF: 158, armB: 164, legF: 118, legB: 124, head: 0, sx: 1, sy: 1 };
  const s: Record<string, boolean> = {};
  return {
    end: 5000,
    rest: 5000,
    update(t, _k, still) {
      const a = seg(t, 900, 1120);
      const b = seg(t, 1120, 1450);
      const sc = t < 1120 ? 1 - E.in(a) : E.back(b);
      if (t >= 1120 && !flipped) setCard(false);
      if (t < 1120 && flipped) setCard(true);
      card.setAttribute("transform", `translate(0 43) scale(1 ${f2(Math.max(0.02, sc))}) translate(0 -43)`);
      once(s, "spark", !still && t >= 1350, () => sparkles(st, 106, 43, 12, "#9ff0ff"));
      once(s, "poof", !still && t >= 1520, () => {
        sparkles(st, 72, 128, 8, "#ffffff");
        sparkles(st, 72, 128, 8, CLUB_CYAN);
      });
      if (t < 1500) {
        const sway = Math.sin(t / 240) * 7;
        sw.set({ ...SIT, legF: SIT.legF + sway, legB: SIT.legB - sway, hoodie: 1 });
      } else if (t < 2350) {
        const u = seg(t, 1500, 1700);
        const hop = t > 1700 ? Math.abs(Math.sin(((t - 1700) / 650) * Math.PI * 2)) : 0;
        const land = t > 1700 ? Math.max(0, Math.cos(((t - 1700) / 650) * Math.PI * 2)) : 0;
        sw.set({ hoodie: 1 - seg(t, 1500, 1680), x: 72, y: lerp(172, 156, u) - 10 * hop, rot: -90, armF: lerp(158, 4, E.out(u)), armB: lerp(164, -6, E.out(u)), legF: lerp(118, 176, u), legB: lerp(124, 184, u), head: 0, sx: 1 - 0.05 * land * (1 - hop), sy: 1 + 0.06 * land * (1 - hop) });
      } else if (t < 3050) {
        const u = seg(t, 2350, 3050);
        sw.set({ x: lerp(72, 246, u), y: lerp(156, 129, u) - 24 * 4 * u * (1 - u), rot: lerp(-90, 32, E.inOut(u)), armF: lerp(4, 30, u), armB: lerp(-6, 34, u), legF: lerp(176, 68, E.inOut(u)), legB: lerp(184, 72, E.inOut(u)), head: lerp(0, -38, u), sx: 1, sy: 1 });
      } else {
        const sq = 1 - E.out(seg(t, 3050, 3300));
        sw.set({ ...READY, x: 246, y: 129 + 2 * sq + Math.sin(t / 260) * 0.5, sx: 1 + 0.05 * sq, sy: 1 - 0.07 * sq });
      }
      block.plate.setAttribute("fill", t > 3050 ? "#0879a0" : C.red);
      once(s, "land", !still && t >= 3050, () => sparkles(st, 250, 176, 10));
    },
    draw() {
      pool.draw(st.t);
    },
  } satisfies Scene;
};

export interface MedalParams {
  place: 1 | 2 | 3;
  caption: string; // "3. místo v ročníku 2016"
  sub?: string; // "50 m znak"
}

const MEDAL = { 1: ["#ffd84d", "#a87b00"], 2: ["#eef3f6", "#7d909c"], 3: ["#f0a76b", "#9a4f1c"] } as const;

export const medalScene = ({ place, caption, sub }: MedalParams, look: Look): SceneFactory => (st) => {
  const svg = st.svg;
  const defs = S("defs", undefined, svg);
  hallBackdrop(svg, defs, true);
  // the pool behind the podium
  S("rect", { x: -2, y: 204, width: 404, height: 28, fill: "#3cc0e4", stroke: C.ink, "stroke-width": 1.2 }, svg);
  for (let x = 6, i = 0; x < 400; x += 13, i++) S("ellipse", { cx: x, cy: 205, rx: 5.2, ry: 3, fill: x < 60 || x > 340 ? C.red : i % 2 ? C.white : C.blue, stroke: C.ink, "stroke-width": 0.9 }, svg);
  S("rect", { x: -2, y: 230, width: 404, height: 72, fill: "#e3f2f7", stroke: C.ink, "stroke-width": 1.6 }, svg);
  const steps = [
    { n: 2, x: 72, w: 86, top: 184 },
    { n: 1, x: 158, w: 86, top: 162 },
    { n: 3, x: 244, w: 86, top: 198 },
  ];
  for (const st2 of steps) {
    S("rect", { x: st2.x, y: st2.top, width: st2.w, height: 232 - st2.top, fill: "#ffffff", stroke: C.ink, "stroke-width": 1.8 }, svg);
    const tx = S("text", { x: st2.x + st2.w / 2, y: st2.top + (232 - st2.top) / 2 + 8, "text-anchor": "middle", "font-size": 22, "font-weight": 800, fill: CLUB_BLUE, "font-family": "Bricolage Grotesque, Lexend, system-ui, sans-serif" }, svg);
    tx.textContent = String(st2.n);
  }
  const mine = steps.find((x) => x.n === place) ?? steps[2];
  const cx = mine.x + mine.w / 2 - 4;
  const hipsY = mine.top - 43;
  const actors = S("g", undefined, svg);
  const top = S("g", undefined, svg);
  const sw = cartoonSwimmer(actors, look);
  const [light, dark] = MEDAL[place];
  const medal = S("g", undefined, top);
  S("path", { d: "M-8,-30 L-2,-10 M8,-30 L2,-10", stroke: CLUB_CYAN, "stroke-width": 4.2, "stroke-linecap": "round", fill: "none" }, medal);
  S("circle", { cx: 0, cy: 0, r: 11.5, fill: light, stroke: C.ink, "stroke-width": 1.8 }, medal);
  S("circle", { cx: 0, cy: 0, r: 8, fill: "none", stroke: dark, "stroke-width": 1.6, opacity: 0.55 }, medal);
  const num = S("text", { x: 0, y: 4.6, "text-anchor": "middle", "font-size": 12, "font-weight": 800, fill: dark, "font-family": "Bricolage Grotesque, Lexend, system-ui, sans-serif" }, medal);
  num.textContent = String(place);
  const cap = S("g", { opacity: 0 }, top);
  const cw = Math.min(260, 36 + Math.max(caption.length * 7.6, (sub ?? "").length * 6.9));
  S("rect", { x: 14, y: 70, width: cw, height: sub ? 44 : 30, rx: 14, fill: "#ffffff", stroke: C.ink, "stroke-width": 1.8 }, cap);
  const ct = S("text", { x: 14 + cw / 2, y: 90, "text-anchor": "middle", "font-size": 12.5, "font-weight": 800, fill: C.ink, "font-family": FONT }, cap);
  ct.textContent = caption;
  if (sub) {
    const cs = S("text", { x: 14 + cw / 2, y: 106, "text-anchor": "middle", "font-size": 10.5, "font-weight": 600, fill: CLUB_BLUE, "font-family": FONT }, cap);
    cs.textContent = sub;
  }
  const s: Record<string, boolean> = {};
  return {
    end: 4800,
    rest: 4800,
    update(t, _k, still) {
      // a little hop onto her step, then waving
      const hop = still ? 1 : E.back(seg(t, 0, 450));
      const wave = t > 1300 ? Math.sin((t - 1300) / 150) * 20 : 0;
      sw.set({ x: cx, y: lerp(hipsY + 14, hipsY, hop) - Math.sin(Math.PI * seg(t, 0, 450)) * 12, rot: -90, armF: -14 + wave, armB: 172, legF: 178, legB: 182, head: 0, hoodie: 1, sx: 1, sy: 1 });
      // the medal drops onto her chest
      const d = still ? 1 : seg(t, 450, 1250);
      const my = lerp(-50, hipsY - 18, E.back(d));
      const swing = t > 1250 ? Math.sin((t - 1250) / 230) * 10 * Math.exp(-(t - 1250) / 900) : 0;
      medal.setAttribute("transform", `translate(${f2(cx + 11)} ${f2(my)}) rotate(${f2(swing)})`);
      const cp = still ? 1 : seg(t, 1150, 1450);
      cap.setAttribute("opacity", f2(cp));
      cap.setAttribute("transform", `translate(${f2(14 + cw / 2)} 92) scale(${f2(Math.max(0.01, E.back(cp)))}) translate(${f2(-14 - cw / 2)} -92)`);
      once(s, "party", !still && t >= 1250, () => {
        confetti(st, cx, 60, 80);
        sparkles(st, cx + 11, hipsY - 18, 14);
      });
    },
  } satisfies Scene;
};
