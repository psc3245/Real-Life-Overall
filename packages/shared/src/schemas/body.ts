import { z } from "zod";
import type { UnitSystem } from "../units";

/** Height and weight tracking (DESIGN.md §7.5). Each is opt-in; values are stored in kg and cm. */
export const BODY_KINDS = ["weight", "height"] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

export interface BodyEntryDto {
  localDate: string;
  weightKg: number | null;
  heightCm: number | null;
}

export interface BodyDto {
  unitSystem: UnitSystem;
  trackWeight: boolean;
  trackHeight: boolean;
  /** Newest first. */
  entries: BodyEntryDto[];
}

/** The day log's body section; null on DayDto when nothing is tracked. */
export interface DayBodyDto {
  trackWeight: boolean;
  trackHeight: boolean;
  weightKg: number | null;
  heightCm: number | null;
  /** The latest earlier values, as placeholders. */
  lastWeightKg: number | null;
  lastHeightCm: number | null;
}

export const saveBodyBodySchema = z
  .object({
    /** null clears the day's value. */
    weightKg: z.number().finite().min(20).max(500).nullable(),
    heightCm: z.number().finite().min(50).max(260).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide a weight or a height");
