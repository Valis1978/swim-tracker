// Tiny animation engine for the swim moments: SVG scene + canvas particles + a spring-chain water surface.
// No dependencies; only touches the DOM inside Stage (created from a client component effect).

export const NS = "http://www.w3.org/2000/svg";

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const E = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  back: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
export const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
export const T = (x: number, y: number, r = 0, sx = 1, sy = 1) =>
  `translate(${f2(x)} ${f2(y)}) rotate(${f2(r)}) scale(${f2(sx)} ${f2(sy)})`;

export function S(tag: string, attrs?: Record<string, string | number>, parent?: Element): SVGElement {
  const e = document.createElementNS(NS, tag) as SVGElement;
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

let uid = 0;
export const uidOf = (p: string) => `${p}${++uid}`;

export function once(state: Record<string, boolean>, key: string, cond: boolean, fn: () => void) {
  if (cond && !state[key]) {
    state[key] = true;
    fn();
  }
}

// ---- water: heights at fixed columns, neighbours coupled by springs ----------------------------

export class Water {
  h: Float32Array;
  v: Float32Array;
  private L: Float32Array;
  private R: Float32Array;
  constructor(public y0: number, public x0 = 0, public x1 = 400, public n = 70) {
    this.h = new Float32Array(n);
    this.v = new Float32Array(n);
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  col(x: number) {
    return clamp(Math.round(((x - this.x0) / (this.x1 - this.x0)) * (this.n - 1)), 0, this.n - 1);
  }
  hit(x: number, force: number, spread = 2) {
    if (x < this.x0 || x > this.x1) return;
    const c = this.col(x);
    for (let k = -spread; k <= spread; k++) {
      const j = c + k;
      if (j >= 0 && j < this.n) this.v[j] += force * (1 - Math.abs(k) / (spread + 1));
    }
  }
  step() {
    const { h, v, n, L, R } = this;
    for (let i = 0; i < n; i++) {
      v[i] += -0.022 * h[i] - 0.02 * v[i];
      h[i] += v[i];
    }
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < n; i++) {
        if (i > 0) {
          L[i] = 0.19 * (h[i] - h[i - 1]);
          v[i - 1] += L[i];
        }
        if (i < n - 1) {
          R[i] = 0.19 * (h[i] - h[i + 1]);
          v[i + 1] += R[i];
        }
      }
      for (let i = 0; i < n; i++) {
        if (i > 0) h[i - 1] += L[i];
        if (i < n - 1) h[i + 1] += R[i];
      }
    }
  }
  calm() {
    for (let i = 0; i < this.n; i++) if (Math.abs(this.h[i]) > 0.04 || Math.abs(this.v[i]) > 0.04) return false;
    return true;
  }
  y(x: number) {
    const p = ((clamp(x, this.x0, this.x1) - this.x0) / (this.x1 - this.x0)) * (this.n - 1);
    const i = clamp(Math.floor(p), 0, this.n - 2);
    return this.y0 + lerp(this.h[i], this.h[i + 1], p - i);
  }
  slope(x: number) {
    return (this.y(x + 4) - this.y(x - 4)) / 8;
  }
  surface() {
    const dx = (this.x1 - this.x0) / (this.n - 1);
    const px = (i: number) => this.x0 + i * dx;
    const py = (i: number) => this.y0 + this.h[i];
    let d = `M${f2(px(0))},${f2(py(0))}`;
    for (let i = 1; i < this.n - 1; i++) {
      d += ` Q${f2(px(i))},${f2(py(i))} ${f2((px(i) + px(i + 1)) / 2)},${f2((py(i) + py(i + 1)) / 2)}`;
    }
    return d + ` L${f2(px(this.n - 1))},${f2(py(this.n - 1))}`;
  }
  body(bottom = 310) {
    return `${this.surface()} L${f2(this.x1)},${bottom} L${f2(this.x0)},${bottom} Z`;
  }
}

// ---- particles (drawn on the canvas above the scene) -------------------------------------------

export type ParticleKind = "drop" | "bubble" | "confetti" | "spark";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  g: number;
  drag: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  alpha: number;
  ph: number;
}

export class Particles {
  list: Particle[] = [];
  add(p: Partial<Particle> & { x: number; y: number }) {
    this.list.push({ kind: "drop", vx: 0, vy: 0, life: 1, decay: 0.01, g: 0.22, drag: 0.992, size: 2, rot: 0, vr: 0, color: "#ffffff", alpha: 1, ph: Math.random() * 6, ...p });
  }
  step(k: number, water: Water | null) {
    for (const p of this.list) {
      if (p.kind === "bubble") {
        p.ph += 0.16 * k;
        p.x += (Math.sin(p.ph) * 0.35 + p.vx) * k;
        p.vy = Math.max(p.vy - 0.035 * k, -1.4);
        p.y += p.vy * k;
        if (water && p.y <= water.y(p.x) + 1) p.life = 0;
      } else {
        p.vy += p.g * k;
        const d = Math.pow(p.drag, k);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        if (p.kind === "drop" && water && p.vy > 0 && p.x > water.x0 && p.x < water.x1 && p.y > water.y(p.x)) {
          p.life = 0;
          water.hit(p.x, 0.12 * p.size, 0);
        }
      }
      p.life -= p.decay * k;
    }
    this.list = this.list.filter((p) => p.life > 0 && p.y < 330 && p.x > -60 && p.x < 460);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(Math.min(1, p.life * 2.2) * p.alpha, 0, 1);
      if (p.kind === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.9 + 0.1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === "bubble") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "spark") {
        const r = p.size * (0.6 + 0.4 * Math.sin(p.ph * 3));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const rr = i % 2 ? r * 0.35 : r;
          ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        p.ph += 0.05;
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 1.25, p.size * 0.85, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---- stage -----------------------------------------------------------------------------------

export interface Scene {
  end: number; // ms; the scene holds its last frame afterwards
  rest?: number; // ms of a calm frame shown when motion is reduced
  update(t: number, k: number, still: boolean): void;
  draw?(): void;
  // canvas-only scenes paint the whole canvas themselves
  paintsCanvas?: boolean;
}
export type SceneFactory = (st: Stage) => Scene;

export class Stage {
  svg: SVGSVGElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  parts = new Particles();
  water: Water | null = null;
  scene: Scene | null = null;
  t = 0;
  k = 1;
  private prev = 0;
  private acc = 0;
  private raf = 0;
  private visible = false;
  private running = false;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  onEnd?: () => void;

  constructor(public root: HTMLElement) {
    this.svg = S("svg", { viewBox: "0 0 400 300", "aria-hidden": "true" }) as SVGSVGElement;
    this.svg.setAttribute("class", "absolute inset-0 h-full w-full");
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
    root.append(this.svg, this.canvas);
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.tick = this.tick.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.io = new IntersectionObserver(
      (es) => {
        this.visible = es.some((e) => e.isIntersecting);
        if (this.visible) this.wake();
      },
      { threshold: 0.1 }
    );
    this.io.observe(root);
    this.resize();
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.k = this.canvas.width / 400;
    this.render();
  }

  play(make: SceneFactory, { animate = true }: { animate?: boolean } = {}) {
    this.svg.replaceChildren();
    this.parts.list = [];
    this.water = null;
    this.t = 0;
    this.acc = 0;
    this.scene = make(this);
    if (!animate) {
      this.t = this.scene.rest ?? this.scene.end;
      this.scene.update(this.t, 0, true);
      this.running = false;
      this.render();
      return;
    }
    this.running = true;
    this.scene.update(0, 0, false);
    this.render();
    this.wake();
  }

  private wake() {
    if (this.visible && !this.raf) {
      this.prev = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick(ts: number) {
    this.raf = 0;
    if (!this.visible) return;
    const dt = this.prev ? Math.min(48, ts - this.prev) : 16.7;
    this.prev = ts;
    const k = dt / 16.667;
    if (this.scene && this.running) {
      this.t += dt;
      this.scene.update(Math.min(this.t, this.scene.end), k, false);
      if (this.t >= this.scene.end) {
        this.running = false;
        this.onEnd?.();
      }
    }
    if (this.water) {
      this.acc += k;
      let n = 0;
      while (this.acc >= 1 && n++ < 4) {
        this.water.step();
        this.acc -= 1;
      }
    }
    this.parts.step(k, this.water);
    this.render();
    // sleep once everything has settled
    if (this.running || this.parts.list.length || (this.water && !this.water.calm())) this.raf = requestAnimationFrame(this.tick);
  }

  render() {
    this.scene?.draw?.();
    if (this.scene?.paintsCanvas) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.parts.draw(c);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    this.io.disconnect();
    this.root.replaceChildren();
  }
}
