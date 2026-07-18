/**
 * Local-timezone date helpers. Using toISOString() would report UTC,
 * which rolls over to the wrong day near midnight in non-UTC timezones.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentMonthPrefix(): string {
  return todayISO().slice(0, 7);
}

/** Adds (or subtracts, if negative) whole days to a "YYYY-MM-DD" string. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Whole-day difference (b - a) between two "YYYY-MM-DD" strings. */
export function daysBetween(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

/**
 * True if `dateISO` falls within the last `days` days, inclusive of
 * today (a rolling window, e.g. "last 7 days" rather than a calendar
 * week) — avoids ambiguity over which day a calendar week starts on.
 */
export function isWithinLastDays(dateISO: string, days: number): boolean {
  if (!dateISO) return false;
  const diff = daysBetween(dateISO, todayISO());
  return diff >= 0 && diff < days;
}
