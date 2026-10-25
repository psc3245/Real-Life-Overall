/**
 * Measurement units. Weights, distances and heights are stored metric (kg, meters, cm) and
 * shown in the user's system.
 */
export const UNIT_SYSTEMS = ["imperial", "metric"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const KG_PER_LB = 0.45359237;
export const M_PER_MILE = 1609.344;
export const CM_PER_INCH = 2.54;

export const weightUnit = (system: UnitSystem) => (system === "imperial" ? "lb" : "kg");
export const distanceUnit = (system: UnitSystem) => (system === "imperial" ? "mi" : "km");

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** kg → lb or kg, to 0.1. */
export function toDisplayWeight(kg: number, system: UnitSystem): number {
  return round(system === "imperial" ? kg / KG_PER_LB : kg, 1);
}

export function fromDisplayWeight(value: number, system: UnitSystem): number {
  return system === "imperial" ? value * KG_PER_LB : value;
}

/** meters → miles or km, to 0.01. */
export function toDisplayDistance(m: number, system: UnitSystem): number {
  return round(m / (system === "imperial" ? M_PER_MILE : 1000), 2);
}

export function fromDisplayDistance(value: number, system: UnitSystem): number {
  return value * (system === "imperial" ? M_PER_MILE : 1000);
}

/** "5′11″" or "180 cm" */
export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === "metric") return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / CM_PER_INCH);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

/** Body mass index from kg and cm, to 0.1. */
export function bmi(kg: number, cm: number): number {
  const m = cm / 100;
  return round(kg / (m * m), 1);
}

/** Seconds as "m:ss", or "h:mm:ss" from an hour. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Parses "m:ss", "h:mm:ss" or a plain number of minutes into seconds; null if invalid. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}
