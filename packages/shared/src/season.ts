import { addDays } from "./dates";

export interface SeasonPeriod {
  label: string;
  startsOn: string;
  endsOn: string;
}

/** Seasons are calendar months from this date on; before it they were calendar quarters. */
export const MONTHLY_SEASONS_FROM = "2026-12-01";

/**
 * The season containing `localDate` (YYYY-MM-DD in the user's timezone). Seasons are calendar
 * months (labels like "2026-12"); dates before `MONTHLY_SEASONS_FROM` keep their quarters
 * ("2026-Q3"), with 2026-Q4 cut short to end the day before monthly seasons begin.
 */
export function seasonForDate(localDate: string): SeasonPeriod {
  const [yearStr, monthStr] = localDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDayOf = (m: number) => new Date(Date.UTC(year, m, 0)).getUTCDate();
  if (localDate >= MONTHLY_SEASONS_FROM) {
    return {
      label: `${year}-${pad(month)}`,
      startsOn: `${year}-${pad(month)}-01`,
      endsOn: `${year}-${pad(month)}-${pad(lastDayOf(month))}`,
    };
  }
  const quarter = Math.floor((month - 1) / 3) + 1;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endsOn = `${year}-${pad(endMonth)}-${pad(lastDayOf(endMonth))}`;
  const cutoff = addDays(MONTHLY_SEASONS_FROM, -1);
  return {
    label: `${year}-Q${quarter}`,
    startsOn: `${year}-${pad(startMonth)}-01`,
    endsOn: endsOn > cutoff ? cutoff : endsOn,
  };
}

/** The calendar date (YYYY-MM-DD) for `instant` in an IANA timezone. */
export function localDateIn(timeZone: string, instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
