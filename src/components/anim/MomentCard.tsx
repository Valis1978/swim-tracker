"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Stage, type SceneFactory } from "@/lib/anim/engine";
import { diveScene, medalScene, pbScene, reserveScene } from "@/lib/anim/cartoon";
import type { Moment } from "@/lib/moments";

const SEEN = "swim:moments-seen";

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function markSeen(key: string) {
  try {
    const list = readSeen().filter((k) => k !== key);
    list.push(key);
    localStorage.setItem(SEEN, JSON.stringify(list.slice(-80)));
  } catch {
    // private mode or storage blocked: the moment simply plays again next time
  }
}

function sceneOf(m: Moment): SceneFactory {
  switch (m.kind) {
    case "pb":
      return pbScene(m.params);
    case "medal":
      return medalScene(m.params);
    case "reserve":
      return reserveScene(m.params);
    case "dive":
      return diveScene(m.params);
  }
}

const noop = () => () => {};

export default function MomentCard({ moment }: { moment: Moment }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  // decided once per page view, so marking it seen does not hide the animation mid-play
  const [seenBefore] = useState(() => (typeof window === "undefined" ? true : readSeen().includes(moment.key)));
  const [open, setOpen] = useState(false);
  const show = mounted && (!seenBefore || open);

  useEffect(() => {
    if (!show || !host.current) return;
    const st = new Stage(host.current);
    stage.current = st;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    st.play(sceneOf(moment), { animate: !reduced || open });
    markSeen(moment.key);
    return () => {
      st.destroy();
      stage.current = null;
    };
  }, [show, moment, open]);

  if (!mounted) return null;

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-3xl border border-pool-100 bg-white px-4 py-3 text-left transition hover:bg-pool-50"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-deep text-white" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-pool-900">{moment.title}</span>
          <span className="block truncate text-xs text-pool-900/55">Přehrát znovu</span>
        </span>
      </button>
    );
  }

  return (
    <section className="animate-rise overflow-hidden rounded-3xl border border-pool-100 bg-white shadow-[0_14px_30px_-18px_rgb(8_42_60/0.55)]">
      <div ref={host} className="relative aspect-[4/3] w-full bg-[#c5ebf6]" role="img" aria-label={moment.title} />
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold leading-tight text-pool-900">{moment.title}</h2>
          <p className="mt-1 text-sm text-pool-900/65">{moment.text}</p>
          {moment.href && (
            <Link href={moment.href} className="mt-2 inline-block text-sm font-semibold text-pool-600 hover:text-pool-800">
              Detail závodu →
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => stage.current?.play(sceneOf(moment))}
          className="shrink-0 rounded-full border border-pool-200 px-3 py-1.5 text-sm font-semibold text-pool-700 transition hover:bg-pool-50"
        >
          Znovu
        </button>
      </div>
    </section>
  );
}
