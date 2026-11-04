import { isPremiumRole, ROLE_LABELS, type UserRole } from "@rlo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";

/** Marks a premium-only option for free accounts (DESIGN.md §8.9). */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded bg-neon/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-neon ${className}`}
    >
      Premium
    </span>
  );
}

/**
 * What a free account sees in place of a premium page. There's no checkout yet: accounts are
 * upgraded by an admin while the app is in testing.
 */
export function PremiumLocked({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
      <PremiumBadge />
      <p className="font-display text-3xl uppercase">{title}</p>
      {children && <p className="text-court-300">{children}</p>}
      <Link
        to="/upgrade"
        className="inline-block rounded-lg bg-neon px-4 py-2 text-sm font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
      >
        See Premium
      </Link>
    </div>
  );
}

/**
 * The account type as a chip: purple for every premium type (the 90+ "elite" tier color), plain
 * for Free.
 */
export function AccountBadge({ role, size = "sm" }: { role: UserRole; size?: "sm" | "lg" }) {
  const premium = isPremiumRole(role);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-display font-semibold uppercase tracking-wider ${size === "lg" ? "px-3 py-0.5 text-base" : "px-2 py-px text-[10px]"} ${premium ? "border-tier-purple/60 bg-tier-purple/15 text-tier-purple" : "border-court-700 text-court-300"}`}
    >
      {premium && <span aria-hidden="true">★</span>}
      {ROLE_LABELS[role]}
    </span>
  );
}
