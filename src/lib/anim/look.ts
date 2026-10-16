// What Viki's cartoon swimmer wears. The club (OSP Hodonín) kit is royal blue and white:
// a half blue / half white BornToSwim race cap, royal blue hoodies and shorts, white T-shirts.

export const CLUB_BLUE = "#2f55d4";
export const CLUB_BLUE_DARK = "#2244b0";
export const CLUB_CYAN = "#2fb7ea";

export type CapKey = "klub" | "modra" | "bila" | "cervena" | "zluta" | "ruzova" | "tyrkys" | "fialova";

export interface CapStyle {
  key: CapKey;
  label: string;
  base: string;
  hi: string;
  split?: string; // second colour of a half-and-half cap
  mark?: boolean; // small club mark on the cap
}

export const CAPS: CapStyle[] = [
  { key: "klub", label: "Oddílová", base: CLUB_BLUE, hi: "#9db1ff", split: "#ffffff", mark: true },
  { key: "modra", label: "Modrá", base: CLUB_BLUE, hi: "#9db1ff" },
  { key: "bila", label: "Bílá", base: "#f6f8fa", hi: "#ffffff" },
  { key: "cervena", label: "Červená", base: "#e8504a", hi: "#ffb1a8" },
  { key: "zluta", label: "Žlutá", base: "#ffd23f", hi: "#fff2b0" },
  { key: "ruzova", label: "Růžová", base: "#ff6fae", hi: "#ffc6df" },
  { key: "tyrkys", label: "Tyrkysová", base: "#1fbfc0", hi: "#a6f1ef" },
  { key: "fialova", label: "Fialová", base: "#8b5cf6", hi: "#d2c0ff" },
];

export const DEFAULT_CAP: CapKey = "klub";

export function isCapKey(k: unknown): k is CapKey {
  return typeof k === "string" && CAPS.some((c) => c.key === k);
}

export function capOf(key: string | null | undefined): CapStyle {
  return CAPS.find((c) => c.key === key) ?? CAPS[0];
}

export interface Look {
  cap: CapKey;
}

// head geometry shared by the scenes and the picker preview (head space: top of the head = +x, face = +y)
export const CAP_PATH = "M8.66,7.26 A11.3,11.3 0 1 0 -9.79,-5.65 Q-1,1.5 8.66,7.26 Z";
export const CAP_FRONT_HALF = "M10,-17.3 L30,-17.3 L30,30 L-10,17.3 Z";
export const CAP_SEAM = "M-10,17.3 L10,-17.3";
