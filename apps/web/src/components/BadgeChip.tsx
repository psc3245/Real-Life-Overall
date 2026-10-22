import type { BadgeTier, EarnedBadgeDto } from "@rlo/shared";

export const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: "#cd8a4b",
  silver: "#c9d1d9",
  gold: "#f2c14e",
  hof: "var(--color-tier-purple)",
};

/** A medallion for a tier; personal badges get the neon star; locked ones are empty and muted. */
export function Medallion({
  tier,
  size = 36,
  locked = false,
}: {
  tier: BadgeTier | null;
  size?: number;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 rounded-full border-2 border-dashed border-court-700"
        style={{ width: size, height: size }}
      />
    );
  }
  const color = tier ? TIER_COLORS[tier] : "var(--color-neon)";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display font-bold"
      style={{
        width: size,
        height: size,
        borderColor: color,
        color,
        boxShadow: tier ? `0 0 12px -4px ${color}` : `0 0 12px -2px ${color}`,
        fontSize: size * 0.42,
      }}
    >
      {tier === "hof" ? "★" : tier ? tier[0]!.toUpperCase() : "✦"}
    </span>
  );
}

/** "New badge" line used on recaps and weekly reviews. */
export function EarnedBadges({ badges }: { badges: EarnedBadgeDto[] }) {
  if (!badges.length) return null;
  return (
    <div className="space-y-2 rounded-lg border border-neon/30 bg-neon/5 p-3">
      <p className="font-display text-sm uppercase tracking-wider text-neon">
        New badge{badges.length > 1 ? "s" : ""}
      </p>
      <ul className="space-y-2">
        {badges.map((b) => (
          <li key={`${b.key}-${b.tier}`} className="flex items-center gap-3">
            <Medallion tier={b.tier} size={30} />
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-court-300">{b.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
