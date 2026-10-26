import {
  computeNodeValues,
  growthDelta,
  leafScoresFromEvents,
  type EarnedBadgeDto,
  type RatingNodeDto,
  type RecapDto,
  type SeasonMode,
} from "@rlo/shared";
import type { RatingEventRow } from "../repos/rating-event-repo";
import type { RecapRow } from "../repos/recap-repo";

/** Builds the recap view, with scores in the season's mode as of this recap. */
export function toRecapDto(
  recap: RecapRow,
  nodes: RatingNodeDto[],
  seasonEvents: RatingEventRow[],
  mode: SeasonMode,
  badges: EarnedBadgeDto[] = [],
): RecapDto {
  const own = seasonEvents.filter((e) => e.recapId === recap.id);
  const upTo = seasonEvents.filter((e) => e.createdAt <= recap.createdAt);
  const after = leafScoresFromEvents(mode, upTo);
  const before = leafScoresFromEvents(
    mode,
    upTo.filter((e) => e.recapId !== recap.id),
  );
  const root = nodes.find((n) => n.parentId === null);
  const overall = (leaves: Map<string, number>) =>
    root ? (computeNodeValues(nodes, leaves).get(root.id) ?? null) : null;
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const output = recap.output as { flags?: string[] };

  return {
    id: recap.id,
    date: recap.periodStart,
    mode,
    narrative: recap.narrative,
    flags: output.flags ?? [],
    changes: own
      .map((e) => ({
        nodeId: e.nodeId,
        nodeName: names.get(e.nodeId) ?? "Unknown",
        delta: e.delta,
        growth: growthDelta(e),
        reason: e.reason,
        evidence: ((e.evidence as { quote?: string } | null)?.quote ?? null) as string | null,
        valueAfter: after.get(e.nodeId) ?? 0,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    overallBefore: overall(before),
    overallAfter: overall(after),
    badges,
    createdAt: recap.createdAt.toISOString(),
  };
}
