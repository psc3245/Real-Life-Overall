import type { RatingTierKey } from "@rlo/shared";

export function tierColor(tier: RatingTierKey): string {
  return `var(--color-tier-${tier})`;
}
