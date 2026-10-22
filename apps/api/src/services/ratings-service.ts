import {
  computeNodeValues,
  leafIds,
  leafValuesFromEvents,
  localDateIn,
  type ChangeFeedItemDto,
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
import * as goalRepo from "../repos/goal-repo";
import * as recapRepo from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import { applyDecay } from "./decay-service";
import { datedEvents } from "./event-dates";
import { trends } from "./history-service";
import type { OnboardingResult } from "./onboarding-service";

/** The user's current ratings: leaf values from the ledger, parents rolled up by weight. */
export async function getRatings(db: Database, userId: string): Promise<RatingsDto> {
  const season = await seasonRepo.findLatestActive(db, userId);
  if (!season) throw notFound("No ratings yet. Finish onboarding first.");
  await applyDecay(db, userId); // catch up if the scheduled job hasn't run yet

  const [nodes, events, archetype, session, dated, user] = await Promise.all([
    nodeRepo.findActiveBySeason(db, season.id),
    eventRepo.findActiveBySeason(db, season.id),
    seasonRepo.findArchetype(db, season.id),
    onboardingRepo.findBySeason(db, season.id),
    eventRepo.findActiveWithDates(db, season.id).then(datedEvents),
    userRepo.findById(db, userId),
  ]);
  const trend = trends(nodes, dated, localDateIn(user?.timezone ?? "UTC"));
  const leaves = new Set(leafIds(nodes));
  const values = computeNodeValues(nodes, leafValuesFromEvents(events));
  const rules = new Map(
    (await decayRuleRepo.findActiveByNodes(db, [...leaves])).map((r) => [r.nodeId, r]),
  );
  // The most recent event explains each leaf's current value.
  const latest = new Map(events.map((e) => [e.nodeId, e]));
  const result = session?.result as OnboardingResult | null | undefined;
  const [goals, latestWeekly] = await Promise.all([
    goalRepo.findByNodes(
      db,
      nodes.map((n) => n.id),
    ),
    recapRepo.findWeeklyHistory(db, userId, 1),
  ]);
  const goalByNode = new Map(goals.map((g) => [g.nodeId, g.targetValue]));
  const weeklyOutput = latestWeekly[0]?.output as
    { projections?: { nodeId: string; value: number }[] } | undefined;
  const projections = new Map((weeklyOutput?.projections ?? []).map((p) => [p.nodeId, p.value]));

  return {
    season,
    archetype: archetype
      ? {
          name: archetype.name,
          description: archetype.description || result?.archetypeDescription || "",
        }
      : null,
    projectedThrough: projections.size ? (latestWeekly[0]?.periodEnd ?? null) : null,
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
        trend: trend.get(n.id) ?? null,
        goal: goalByNode.get(n.id) ?? null,
        projection: projections.get(n.id) ?? null,
      };
    }),
  };
}

/** Recent rating changes for the active season, newest first. */
export async function getChanges(
  db: Database,
  userId: string,
  limit: number,
): Promise<ChangeFeedItemDto[]> {
  const season = await seasonRepo.findLatestActive(db, userId);
  if (!season) return [];
  const rows = await eventRepo.findFeed(db, season.id, limit);
  return rows.map(({ recapDate, decayDate, ...r }) => ({
    ...r,
    date: recapDate ?? decayDate,
    createdAt: r.createdAt.toISOString(),
  }));
}
