import { dayOfWeek, WEEKDAY_LETTERS, type HabitDayStat, type HabitStatRange } from "@rlo/shared";
import { shortDate } from "../../lib/format";

function dayClass(d: HabitDayStat, today: string) {
  if (d.done) return "border-neon bg-neon text-court-950";
  if (d.future || d.date === today)
    return d.scheduled ? "border-dashed border-court-500" : "border-transparent";
  if (d.scheduled) return "border-tier-red/60 bg-tier-red/10";
  return "border-court-800 bg-court-800/40";
}

const dayTitle = (d: HabitDayStat, today: string) =>
  [
    shortDate(d.date),
    d.done
      ? "done"
      : d.future || d.date === today
        ? d.scheduled
          ? "to do"
          : ""
        : d.scheduled
          ? "missed"
          : "off",
    d.value && d.value !== "—" ? d.value : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** Week: seven labeled boxes. Month and season: a compact calendar strip. */
export function DayStrip({
  days,
  range,
  today,
}: {
  days: HabitDayStat[];
  range: HabitStatRange;
  today: string;
}) {
  if (range === "week") {
    return (
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Days this week">
        {days.map((d) => (
          <li key={d.date} title={dayTitle(d, today)} className="space-y-1 text-center">
            <span className="block text-[10px] uppercase text-court-500">
              {WEEKDAY_LETTERS[dayOfWeek(d.date)]}
            </span>
            <span
              className={`flex h-8 items-center justify-center rounded-md border text-xs ${dayClass(d, today)}`}
            >
              <span className="sr-only">{dayTitle(d, today)}</span>
              {d.done ? "✓" : ""}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="flex flex-wrap gap-1" aria-label={`Days this ${range}`}>
      {days.map((d) => (
        <li
          key={d.date}
          title={dayTitle(d, today)}
          className={`h-3.5 w-3.5 rounded-sm border ${dayClass(d, today)}`}
        >
          <span className="sr-only">{dayTitle(d, today)}</span>
        </li>
      ))}
    </ol>
  );
}
