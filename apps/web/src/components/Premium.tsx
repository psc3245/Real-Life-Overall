import type { ReactNode } from "react";

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
      <p className="text-sm text-court-500">
        Premium is invite-only while the app is in testing. Ask the team to upgrade your account.
      </p>
    </div>
  );
}
