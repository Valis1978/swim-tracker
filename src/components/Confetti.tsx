"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#0e97bf", "#2cb5da", "#6fd2ec", "#f5a623", "#ff6b5e", "#ffd166", "#ffffff"];

// Lightweight canvas confetti — no deps, fires once on mount, respects reduced motion.
export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);

    interface P { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; delay: number }
    const parts: P[] = Array.from({ length: 160 }, (_, i) => ({
      x: Math.random() * W,
      y: -40 * dpr - Math.random() * H * 0.4,
      vx: (Math.random() - 0.5) * 2.2 * dpr,
      vy: (2.2 + Math.random() * 2.6) * dpr,
      w: (5 + Math.random() * 6) * dpr,
      h: (8 + Math.random() * 8) * dpr,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 35,
    }));

    let frame = 0;
    let raf = 0;
    const DURATION = 420; // ~7 s @ 60fps

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, W, H);
      const fade = frame > DURATION - 60 ? Math.max(0, (DURATION - frame) / 60) : 1;
      ctx.globalAlpha = fade;
      for (const p of parts) {
        if (frame < p.delay) continue;
        p.x += p.vx + Math.sin((frame + p.rot * 50) / 18) * 0.6 * dpr;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H + 20 * dpr) { p.y = -20 * dpr; p.x = Math.random() * W; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.max(1, p.h * Math.abs(Math.cos(frame / 14 + p.rot))));
        ctx.restore();
      }
      if (frame < DURATION) raf = requestAnimationFrame(tick);
      else canvas.remove();
    };
    raf = requestAnimationFrame(tick);
    if ("vibrate" in navigator) navigator.vibrate?.([60, 40, 60]);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 z-[100] pointer-events-none w-screen h-dvh"
      aria-hidden="true"
    />
  );
}
