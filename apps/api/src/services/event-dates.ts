import * as eventRepo from "../repos/rating-event-repo";

export type DatedEvent = Awaited<
  ReturnType<typeof eventRepo.findActiveWithDates>
>[number]["event"] & {
  /** Local day the change belongs to; null for onboarding (before any day). */
  date: string | null;
};

/** Each event's local date: recap/decay day; weekly corrections count on the week's last day. */
export function datedEvents(
  rows: Awaited<ReturnType<typeof eventRepo.findActiveWithDates>>,
): DatedEvent[] {
  return rows.map((r) => ({
    ...r.event,
    date: r.recapKind === "weekly" ? r.recapEnd : (r.recapStart ?? r.decayDate),
  }));
}

/** Events that had happened by the end of `date`. */
export const asOf = (events: DatedEvent[], date: string) =>
  events.filter((e) => e.date === null || e.date <= date);
