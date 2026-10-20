import { clampRating, roundRating } from "./math";

export interface LedgerEvent {
  nodeId: string;
  delta: number;
  voidedAt?: Date | string | null;
}

/** A leaf's value is the clamped sum of its non-voided rating events (see DESIGN.md §4.4). */
export function leafValuesFromEvents(events: Iterable<LedgerEvent>): Map<string, number> {
  const sums = new Map<string, number>();
  for (const e of events) {
    if (e.voidedAt) continue;
    sums.set(e.nodeId, (sums.get(e.nodeId) ?? 0) + e.delta);
  }
  return new Map([...sums].map(([id, sum]) => [id, roundRating(clampRating(sum))]));
}
