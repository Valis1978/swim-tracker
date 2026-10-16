// Europe/Prague wall-clock helpers. The server runs in UTC, while CSPS dates and deadlines
// are local Prague times without an offset ("2026-10-15T09:00:00").

const PRAGUE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "YYYY-MM-DDTHH:MM" in Prague
export function pragueNow(d: Date = new Date()): string {
  return PRAGUE.format(d).replace(" ", "T");
}

export function pragueToday(d: Date = new Date()): string {
  return pragueNow(d).slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const t = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((+new Date(`${to.slice(0, 10)}T12:00:00Z`) - +new Date(`${from.slice(0, 10)}T12:00:00Z`)) / 86400_000);
}

export function minutesToClock(m: number | null | undefined): string | null {
  if (m == null || m < 0) return null;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

// "dnes" | "zítra" | "za 3 dny" | "včera" | "před 5 dny"
export function relativeDay(target: string, today: string = pragueToday()): string {
  const d = daysBetween(today, target);
  if (d === 0) return "dnes";
  if (d === 1) return "zítra";
  if (d === -1) return "včera";
  if (d > 1) return `za ${d} ${d < 5 ? "dny" : "dní"}`;
  return `před ${-d} dny`;
}

const WEEKDAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

export function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay()];
}

// "17. 10." / "17. 10. 2026"
export function shortDate(date: string, withYear = false): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return withYear ? `${d}. ${m}. ${y}` : `${d}. ${m}.`;
}

// "15. 10. v 9:00" for local deadlines
export function deadline(dt: string): string {
  const time = dt.slice(11, 16);
  return time && time !== "00:00" ? `${shortDate(dt)} v ${Number(time.slice(0, 2))}:${time.slice(3, 5)}` : shortDate(dt);
}
