import {
  computeNodeValues,
  leafIds,
  leafValuesFromEvents,
  type Confidence,
  type RatingsDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { notFound } from "../errors";
import * as decayRuleRepo from "../repos/decay-rule-repo";
import * as onboardingRepo from "../repos/onboarding-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import type { OnboardingResult } from "./onboarding-service";

/** The user's current ratings: leaf values from the ledger, parents rolled up by weight. */
export async function getRatings(db: Database, userId: string): Promise<RatingsDto> {
  const season = await seasonRepo.findLatestActive(db, userId);
  if (!season) throw notFound("No ratings yet. Finish onboarding first.");

  const [nodes, events, archetype, session] = await Promise.all([
    nodeRepo.findActiveBySeason(db, season.id),
    eventRepo.findActiveBySeason(db, season.id),
    seasonRepo.findArchetype(db, season.id),
    onboardingRepo.findBySeason(db, season.id),
  ]);
  const leaves = new Set(leafIds(nodes));
  const values = computeNodeValues(nodes, leafValuesFromEvents(events));
  const rules = new Map(
    (await decayRuleRepo.findActiveByNodes(db, [...leaves])).map((r) => [r.nodeId, r]),
  );
  // The most recent event explains each leaf's current value.
  const latest = new Map(events.map((e) => [e.nodeId, e]));
  const result = session?.result as OnboardingResult | null | undefined;

  return {
    season,
    archetype: archetype
      ? { name: archetype, description: result?.archetypeDescription ?? "" }
      : null,
    summary: result?.summary ?? null,
    nodes: nodes.map((n) => {
      const event = leaves.has(n.id) ? latest.get(n.id) : undefined;
      const rule = rules.get(n.id);
      const evidence = event?.evidence as { confidence?: Confidence } | null | undefined;
      return {
        ...n,
        value: values.get(n.id) ?? null,
        rationale: event?.reason ?? null,
        confidence: evidence?.confidence ?? null,
        decay: rule
          ? { graceDays: rule.graceDays, perDay: rule.perDay, floor: rule.floor, notes: rule.notes }
          : null,
      };
    }),
  };
}
