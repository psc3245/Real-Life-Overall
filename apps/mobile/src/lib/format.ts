/**
 * Date and number formatting for the UI. Local dates (YYYY-MM-DD) are formatted in UTC so the
 * calendar day never shifts with the browser's timezone.
 */
const local = (date: string) => new Date(`${date}T00:00:00Z`);
const utc = { timeZone: "UTC" } as const;

/** "Oct 22" */
export const shortDate = (date: string) =>
  local(date).toLocaleDateString(undefined, { ...utc, month: "short", day: "numeric" });

/** "Thu, Oct 22" */
export const dayLabel = (date: string) =>
  local(date).toLocaleDateString(undefined, {
    ...utc,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/** "Thursday, Oct 22" */
export const weekdayDate = (date: string) =>
  local(date).toLocaleDateString(undefined, {
    ...utc,
    weekday: "long",
    month: "short",
    day: "numeric",
  });

/** "Thursday, October 22" */
export const longDate = (date: string) =>
  local(date).toLocaleDateString(undefined, {
    ...utc,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

/** "October 2026" for a local date. */
export const monthYear = (date: string) =>
  local(date).toLocaleDateString(undefined, { ...utc, month: "long", year: "numeric" });

/** "Oct 1 – Dec 31, 2026" */
export const seasonDates = (start: string, end: string) =>
  `${shortDate(start)} – ${shortDate(end)}, ${end.slice(0, 4)}`;

/** "Oct 22, 2026" for a timestamp (ISO string), in the viewer's timezone. */
export const instantDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** "October 2026" for a timestamp (ISO string). */
export const instantMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Whole numbers as-is, others to one decimal. */
export const formatNumber = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
