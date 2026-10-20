/** Calendar-date helpers on YYYY-MM-DD strings (no timezones: these are already local dates). */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Days a user may still log or edit, counting back from today (DESIGN.md §5.2). */
export const BACKFILL_DAYS = 3;

export function isEditableDate(date: string, today: string): boolean {
  return date <= today && date >= addDays(today, -BACKFILL_DAYS);
}
