import {
  distanceUnit,
  formatDuration,
  lengthUnit,
  toDisplayDistance,
  toDisplayLength,
  toDisplayWeight,
  usesLength,
  weightUnit,
  type ExerciseRecordsDto,
  type ExerciseTracking,
  type UnitSystem,
} from "@rlo/shared";
import { useMe } from "@/api/hooks";

/** "12,450 lb" */
export function formatVolume(kg: number, units: UnitSystem) {
  return `${Math.round(toDisplayWeight(kg, units)).toLocaleString()} ${weightUnit(units)}`;
}

/** "1h 5m", "42m", "48s" */
export function formatElapsed(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** "3 days ago", "today", "never" for a timestamp or local date. */
export function since(value: string | null, today: Date = new Date()) {
  if (!value) return "Never";
  const then = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  const days = Math.floor((today.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "A month ago" : `${months} months ago`;
}

export function useUnits(): UnitSystem {
  return useMe().data?.unitSystem ?? "imperial";
}

/** A record's value in the user's units. */
export function formatRecord(
  key: keyof ExerciseRecordsDto,
  value: number,
  units: UnitSystem,
  tracking: ExerciseTracking,
) {
  switch (key) {
    case "heaviestKg":
    case "best1RmKg":
    case "bestSetVolumeKg":
      return `${(Math.round(toDisplayWeight(value, units) * 10) / 10).toLocaleString()} ${weightUnit(units)}`;
    case "longestS":
      return formatDuration(value);
    case "longestM":
      return usesLength(tracking)
        ? `${toDisplayLength(value, units)} ${lengthUnit(units)}`
        : `${toDisplayDistance(value, units)} ${distanceUnit(units)}`;
    case "bestPct":
      return `${Math.round(value)}%`;
    default:
      return String(value);
  }
}
