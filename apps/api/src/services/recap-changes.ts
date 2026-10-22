import { DAILY_DELTA_CAP, dailyRecapOutputSchema, MAX_GUIDED_PROMPTS } from "@rlo/shared";
import type { z } from "zod";

type RawChange = z.infer<typeof dailyRecapOutputSchema>["changes"][number];

export interface RecapChange {
  nodeId: string;
  delta: number;
  reason: string;
  evidence: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Maps refs to rated attributes and enforces the daily cap. Duplicate refs are merged (their
 * deltas summed, then capped); negligible moves are dropped.
 */
export function normalizeRecapChanges(
  raw: RawChange[],
  idByRef: Map<string, string>,
  leafIds: Set<string>,
  cap: number = DAILY_DELTA_CAP,
): RecapChange[] {
  const byNode = new Map<string, RecapChange>();
  for (const c of raw) {
    const nodeId = idByRef.get(c.ref.trim());
    if (!nodeId || !leafIds.has(nodeId) || !Number.isFinite(c.delta)) continue;
    const prior = byNode.get(nodeId);
    byNode.set(nodeId, {
      nodeId,
      delta: (prior?.delta ?? 0) + c.delta,
      reason: prior?.reason ?? c.reason.trim(),
      evidence: prior?.evidence ?? (c.evidence.trim() || null),
    });
  }
  return [...byNode.values()]
    .map((c) => ({
      ...c,
      delta: round2(Math.max(-cap, Math.min(cap, c.delta))),
    }))
    .filter((c) => Math.abs(c.delta) >= 0.01 && c.reason);
}

export function normalizePrompts(raw: string[]): string[] {
  return [...new Set(raw.map((p) => p.trim()).filter(Boolean))].slice(0, MAX_GUIDED_PROMPTS);
}
