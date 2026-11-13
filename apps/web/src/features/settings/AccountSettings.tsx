import {
  isPremiumRole,
  premiumTenure,
  PREMIUM_PERKS,
  ROLE_DETAILS,
  ROLE_LABELS,
} from "@rlo/shared";
import { Link } from "react-router";
import { useAiUsage } from "../../api/account";
import type { Me } from "../../api/hooks";
import { AccountBadge } from "../../components/Premium";
import { SettingsCard } from "./controls";

/** The account type, how long it's been Premium, and the way up for Free (DESIGN.md §8.9). */
export function AccountSettings({ me, id }: { me: Me; id: string }) {
  const premium = isPremiumRole(me.role);
  const tenure = premiumTenure(me.premiumSince);
  return (
    <SettingsCard id={id} title="Account type">
      <div
        className={`flex flex-wrap items-center justify-between gap-4 p-4 ${premium ? "bg-gradient-to-r from-tier-purple/15 to-transparent" : ""}`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <AccountBadge role={me.role} size="lg" />
            {tenure && <span className="text-sm text-court-300">{tenure}</span>}
          </div>
          <p className="text-sm text-court-300">{ROLE_DETAILS[me.role]}</p>
        </div>
        {premium ? (
          me.selfUpgrade && me.role !== "admin" ? (
            <Link to="/upgrade" className="text-sm text-neon hover:underline">
              Change plan →
            </Link>
          ) : (
            me.role !== "premium" && (
              <span className="text-xs uppercase tracking-wider text-court-500">
                {me.role === "dev" ? "Lifetime Premium" : "Premium included"}
              </span>
            )
          )
        ) : (
          <Link
            to="/upgrade"
            className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
          >
            Upgrade to Premium
          </Link>
        )}
      </div>
      <AiUsageMeter premium={premium} />
      <ul className="grid gap-x-6 gap-y-1.5 border-t border-court-800 p-4 text-sm sm:grid-cols-2">
        {PREMIUM_PERKS.map((perk) => (
          <li key={perk} className={`flex gap-2 ${premium ? "text-court-100" : "text-court-500"}`}>
            <span aria-hidden="true" className={premium ? "text-tier-purple" : ""}>
              {premium ? "✓" : "🔒"}
            </span>
            {perk}
          </li>
        ))}
      </ul>
      <p className="sr-only">Account type: {ROLE_LABELS[me.role]}</p>
    </SettingsCard>
  );
}

/** How much of today's AI budget is used, as a share only. */
function AiUsageMeter({ premium }: { premium: boolean }) {
  const usage = useAiUsage();
  if (!usage.data) return null;
  const used = usage.data.usedPercent;
  const bar = used >= 100 ? "bg-flare" : used >= 75 ? "bg-tier-orange" : "bg-neon";
  return (
    <div className="space-y-1.5 border-t border-court-800 p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">AI used today</span>
        <span className="font-display text-lg tabular-nums">{used}%</span>
      </div>
      <div
        role="meter"
        aria-label="AI budget used today"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
        className="h-2 overflow-hidden rounded-full bg-court-800"
      >
        <div
          className={`h-full rounded-full ${bar} transition-[width]`}
          style={{ width: `${used}%` }}
        />
      </div>
      <p className="text-xs text-court-500">
        {used >= 100
          ? "Limit reached. AI features free up as the last 24 hours roll over; recaps still run."
          : "Over the last 24 hours. Recaps and weekly reviews always run, even at the limit."}
        {!premium && " Premium has a bigger budget."}
      </p>
    </div>
  );
}
