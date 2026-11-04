import { premiumTenure, PREMIUM_PERKS } from "@rlo/shared";
import { Link } from "react-router";
import { useAccount } from "../../api/account";
import { useMe } from "../../api/hooks";
import { AccountBadge } from "../../components/Premium";

const FREE_INCLUDES = [
  "Growth seasons: every point you gain counts",
  "Daily recaps and weekly reviews",
  "The Combine for your starting ratings",
  "Habits, goals, workouts, charts and reports",
];

/** Premium's pitch. There's no checkout yet: Premium is invite-only while in testing. */
export function UpgradePage() {
  const { role, premium } = useAccount();
  const me = useMe();
  const tenure = premiumTenure(me.data?.premiumSince ?? null);
  return (
    <div className="mx-auto max-w-4xl space-y-8 pt-6">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-tier-purple">★ Premium</p>
        <h1 className="font-display text-5xl font-bold uppercase md:text-6xl">
          {premium ? "You're on Premium" : "Go Premium"}
        </h1>
        <p className="mx-auto max-w-xl text-court-300">
          {premium
            ? `${tenure ?? "Premium"}. Everything below is unlocked.`
            : "The full front office: Rating seasons, the coach and every AI assist."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-court-700 bg-court-900/60 p-6">
          <h2 className="font-display text-2xl uppercase tracking-wider">Free</h2>
          <p className="text-sm text-court-500">
            {premium ? "All included in Premium" : "What you have now"}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-court-300">
            {FREE_INCLUDES.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </section>
        <section className="relative rounded-2xl border border-tier-purple/60 bg-gradient-to-br from-tier-purple/20 via-court-900/80 to-court-900/60 p-6 shadow-[0_0_40px_-12px] shadow-tier-purple/50">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl uppercase tracking-wider text-tier-purple">
              Premium
            </h2>
            {premium && <AccountBadge role={role} />}
          </div>
          <p className="text-sm text-court-300">Everything in Free, plus</p>
          <ul className="mt-4 space-y-2 text-sm text-court-100">
            {PREMIUM_PERKS.map((perk) => (
              <li key={perk} className="flex gap-2">
                <span aria-hidden="true" className="text-tier-purple">
                  ★
                </span>
                {perk}
              </li>
            ))}
          </ul>
          {!premium && (
            <button
              type="button"
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-lg bg-tier-purple/80 px-4 py-3 font-display text-lg font-semibold uppercase tracking-wider text-court-950 opacity-70"
            >
              Coming soon
            </button>
          )}
        </section>
      </div>

      {!premium && (
        <p className="text-center text-sm text-court-500">
          Premium is invite-only while the app is in testing. Ask the team to upgrade your account.
        </p>
      )}
      <p className="text-center">
        <Link to="/settings#account" className="text-sm text-neon hover:underline">
          ← Account settings
        </Link>
      </p>
    </div>
  );
}
