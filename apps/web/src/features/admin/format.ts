import type { UserRole } from "@rlo/shared";

export const ROLE_STYLE: Record<UserRole, string> = {
  user: "border-court-700",
  premium: "border-neon/60 text-neon",
  dev: "border-tier-purple text-tier-purple",
  admin: "border-tier-orange text-tier-orange",
};

export const usd = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

export const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
