// Swimming strokes as used across the app (CSPS discipline codes end with the stroke letter).

export type StrokeKey = "P" | "Z" | "K" | "M" | "O";

export const STROKE_ORDER: StrokeKey[] = ["P", "Z", "K", "M", "O"];

export const STROKE_META: Record<StrokeKey, { label: string; color: string }> = {
  P: { label: "Prsa", color: "#0f9d74" },
  Z: { label: "Znak", color: "#2f7fe0" },
  K: { label: "Volný způsob", color: "#0a6182" },
  M: { label: "Motýlek", color: "#e8504a" },
  O: { label: "Polohový závod", color: "#c98a06" },
};

// "100 P" -> P, "100 VZ" -> K, "200 PZ" -> O
export function strokeOf(code: string): StrokeKey {
  const s = code.trim().split(/\s+/).pop()?.toUpperCase() ?? "K";
  if (s === "VZ") return "K";
  if (s === "PZ") return "O";
  return (STROKE_ORDER as string[]).includes(s) ? (s as StrokeKey) : "K";
}

export function distanceOf(code: string): number {
  return Number(code.trim().split(/\s+/)[0]) || 0;
}
