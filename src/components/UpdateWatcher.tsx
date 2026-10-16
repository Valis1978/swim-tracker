"use client";

import { useEffect } from "react";

const KEY = "swim:reloaded-for";

// An app added to the phone's home screen keeps the old page in memory for days and has no reload button.
// Whenever it comes back to the foreground, ask the server which build it runs and reload once when it changed.
export default function UpdateWatcher() {
  useEffect(() => {
    let base: string | null = null;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const build = res.ok ? ((await res.json()) as { build?: string }).build : undefined;
        if (!build) return;
        if (base == null) {
          base = build;
          return;
        }
        if (build === base) return;
        let tried = false;
        try {
          tried = sessionStorage.getItem(KEY) === build;
          sessionStorage.setItem(KEY, build);
        } catch {
          // storage blocked: reload anyway, the next page load sets a fresh base
        }
        if (!tried) window.location.reload();
      } catch {
        // offline — try again next time the app is opened
      } finally {
        busy = false;
      }
    };
    const onShow = () => void check();
    onShow();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    const timer = window.setInterval(onShow, 10 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
