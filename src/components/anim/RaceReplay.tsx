"use client";

import { useEffect, useRef, useState } from "react";
import { Stage } from "@/lib/anim/engine";
import { replayScene, type ReplayParams } from "@/lib/anim/replay";

// "Přehrát závod": her race from above against the ghost of the previous record
export default function RaceReplay({ params }: { params: ReplayParams }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !host.current) return;
    const st = new Stage(host.current);
    stage.current = st;
    st.play(replayScene(params));
    return () => {
      st.destroy();
      stage.current = null;
    };
  }, [open, params]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-deep px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-pool-800"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        Přehrát závod{params.ghost != null ? " proti rekordu" : ""}
      </button>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-pool-100">
      <div ref={host} className="relative aspect-[4/3] w-full bg-[#e9f6fa]" role="img" aria-label={`Přehrání závodu ${params.title}`} />
      <div className="flex justify-end gap-2 bg-pool-50 px-3 py-2">
        <button type="button" onClick={() => stage.current?.play(replayScene(params))} className="rounded-full border border-pool-200 bg-white px-3 py-1 text-xs font-semibold text-pool-700 hover:bg-pool-50">
          Znovu
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-xs font-semibold text-pool-900/55 hover:text-pool-900">
          Zavřít
        </button>
      </div>
    </div>
  );
}
