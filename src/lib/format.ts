export function fmtTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 6_000_000) return "DSQ";
  const mins = Math.floor(ms / 60000);
  const secs = (ms % 60000) / 1000;
  const s = secs.toFixed(2).replace(".", ",");
  return mins ? `${mins}:${secs < 10 ? "0" : ""}${s}` : s;
}

export function fmtDelta(ms: number): string {
  const s = (Math.abs(ms) / 1000).toFixed(2).replace(".", ",");
  return `${ms <= 0 ? "−" : "+"}${s} s`;
}

export function fmtDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

export const DISCIPLINE_LABELS: Record<string, string> = {
  "50 P": "50 prsa",
  "100 P": "100 prsa",
  "200 P": "200 prsa",
  "50 K": "50 kraul",
  "100 K": "100 kraul",
  "200 K": "200 kraul",
  "50 Z": "50 znak",
  "100 Z": "100 znak",
  "50 M": "50 motýlek",
  "100 M": "100 motýlek",
  "100 O": "100 polohovka",
  "200 O": "200 polohovka",
};

export function disciplineLabel(code: string): string {
  return DISCIPLINE_LABELS[code] ?? code;
}
