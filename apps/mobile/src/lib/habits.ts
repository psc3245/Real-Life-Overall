import { WEEKDAY_SHORT } from "@rlo/shared";

/** "Every day", "Weekdays", "Weekends" or "Mon, Wed" (as on the web). */
export function scheduleLabel(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "0,6") return "Weekends";
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}
