import { z } from "zod";
import { isValidDate } from "../dates";

export const MAX_PAUSE_REASON = 120;

/** A vacation/injury window during which ratings don't decay. `endsOn` null = open-ended. */
export interface PauseDto {
  id: string;
  startsOn: string;
  endsOn: string | null;
  reason: string;
}

const date = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");

export const createPauseBodySchema = z
  .object({
    startsOn: date,
    endsOn: date.nullable().default(null),
    reason: z.string().trim().max(MAX_PAUSE_REASON).default(""),
  })
  .refine((p) => p.endsOn === null || p.endsOn >= p.startsOn, "End must not be before start");

export const endPauseBodySchema = z.object({ endsOn: date });
