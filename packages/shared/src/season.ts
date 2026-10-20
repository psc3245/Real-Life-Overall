export interface SeasonPeriod {
  label: string;
  startsOn: string;
  endsOn: string;
}

/** Seasons are calendar quarters. `localDate` is YYYY-MM-DD in the user's timezone. */
export function seasonForDate(localDate: string): SeasonPeriod {
  const [yearStr, monthStr] = localDate.split("-");
  const year = Number(yearStr);
  const quarter = Math.floor((Number(monthStr) - 1) / 3) + 1;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    label: `${year}-Q${quarter}`,
    startsOn: `${year}-${pad(startMonth)}-01`,
    endsOn: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
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
