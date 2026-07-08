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
