import {
  clampRating,
  DECAY_LIMITS,
  initialRatingsOutputSchema,
  type Confidence,
  type DecayRuleDto,
} from "@rlo/shared";
import type { z } from "zod";

type Output = z.infer<typeof initialRatingsOutputSchema>;

export interface InitialRating {
  nodeId: string;
  value: number;
  confidence: Confidence;
  rationale: string;
  decay: DecayRuleDto;
}

/** The output schema plus a check that every rated attribute got exactly one rating. */
export function initialRatingsSchemaFor(leafRefs: string[]) {
  return initialRatingsOutputSchema.superRefine((output, ctx) => {
    const seen = output.ratings.map((r) => r.ref.trim());
    const missing = leafRefs.filter((ref) => !seen.includes(ref));
    const duplicated = leafRefs.filter((ref) => seen.filter((s) => s === ref).length > 1);
    if (missing.length) ctx.addIssue({ code: "custom", message: `Missing ratings: ${missing}` });
    if (duplicated.length) ctx.addIssue({ code: "custom", message: `Rated twice: ${duplicated}` });
  });
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Maps refs to leaf ids and forces every number into a valid range. */
export function normalizeInitialRatings(
  output: Output,
  idByRef: Map<string, string>,
  leafIds: Set<string>,
): InitialRating[] {
  const ratings: InitialRating[] = [];
  for (const r of output.ratings) {
    const nodeId = idByRef.get(r.ref.trim());
    if (!nodeId || !leafIds.has(nodeId) || ratings.some((x) => x.nodeId === nodeId)) continue;
    const value = round(clampRating(Number.isFinite(r.value) ? r.value : 50), 1);
    const { graceDays, perDay } = DECAY_LIMITS;
    ratings.push({
      nodeId,
      value,
      confidence: r.confidence,
      rationale: r.rationale.trim(),
      decay: {
        graceDays: Math.round(clamp(r.decayGraceDays, graceDays.min, graceDays.max)),
        perDay: round(clamp(r.decayPerDay, perDay.min, perDay.max), 2),
        floor: round(clamp(Number.isFinite(r.decayFloor) ? r.decayFloor : 0, 0, value), 1),
        notes: "",
      },
    });
  }
  return ratings;
}
