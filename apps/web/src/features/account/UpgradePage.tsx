import { premiumTenure, PREMIUM_PERKS, ROLE_LABELS, type SelfServeRole } from "@rlo/shared";
import { Link } from "react-router";
import { useAccount, useSetOwnRole } from "../../api/account";
import { useMe } from "../../api/hooks";
import { AccountBadge } from "../../components/Premium";
import { ErrorNote } from "../onboarding/ErrorNote";

const PLANS: { role: SelfServeRole; tagline: string; includes: readonly string[] }[] = [
  {
    role: "user",
    tagline: "The core game",
    includes: [
      "Growth seasons: every point you gain counts",
      "Daily recaps and weekly reviews",
      "The Combine for your starting ratings",
      "Habits, goals, workouts, charts and reports",
    ],
  },
  { role: "premium", tagline: "Everything in Free, plus", includes: PREMIUM_PERKS },
  {
    role: "dev",
    tagline: "Play tester: everything in Premium, plus",
    includes: [
      "Features still in testing, like Souls seasons",
      "Report a bug from the account menu",
      "Your feedback shapes what ships next",
    ],
  },
];

/**
 * Free, Premium and Dev side by side. There's no checkout yet, so while `SELF_UPGRADES` is on
 * players switch plans themselves at no charge (DESIGN.md §8.9); off, upgrades go through an admin.
 */
export function UpgradePage() {
  const { role, premium } = useAccount();
  const me = useMe();
  const setRole = useSetOwnRole();
  const tenure = premiumTenure(me.data?.premiumSince ?? null);
  // Admins keep their type; /admin changes it.
  const canSwitch = Boolean(me.data?.selfUpgrade) && role !== "admin";

  const choose = (next: SelfServeRole) => {
    if (
      next === "user" &&
      !window.confirm(
        "Switch to Free? The coach and AI assists lock right away, and a Rating season turns into Growth when the next season starts. You can switch back any time.",
      )
    )
      return;
    setRole.mutate(next);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pt-6">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-tier-purple">★ Premium</p>
        <h1 className="font-display text-5xl font-bold uppercase md:text-6xl">
          {premium ? `You're on ${ROLE_LABELS[role]}` : "Go Premium"}
        </h1>
        <p className="mx-auto max-w-xl text-court-300">
          {premium && tenure ? `${tenure}. ` : ""}
          {canSwitch
            ? "Every plan is free while the app is in testing. Switch whenever you like."
            : "The full front office: Rating seasons, the coach and every AI assist."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.role === role;
          const paid = plan.role !== "user";
          return (
            <section
              key={plan.role}
              className={`flex flex-col rounded-2xl border p-6 ${
                current
                  ? "border-tier-purple/70 bg-gradient-to-br from-tier-purple/20 via-court-900/80 to-court-900/60 shadow-[0_0_40px_-12px] shadow-tier-purple/50"
                  : "border-court-700 bg-court-900/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  className={`font-display text-2xl uppercase tracking-wider ${paid ? "text-tier-purple" : ""}`}
                >
                  {ROLE_LABELS[plan.role]}
                </h2>
                {current && <AccountBadge role={role} />}
              </div>
              <p className="text-sm text-court-300">{plan.tagline}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-court-100">
                {plan.includes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className={paid ? "text-tier-purple" : ""}>
                      {paid ? "★" : "✓"}
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              {current ? (
                <p className="mt-6 py-3 text-center text-sm uppercase tracking-wider text-court-500">
                  Your plan
                </p>
              ) : canSwitch ? (
                <button
                  type="button"
                  disabled={setRole.isPending}
                  onClick={() => choose(plan.role)}
                  className={`mt-6 w-full rounded-lg px-4 py-3 font-display text-lg font-semibold uppercase tracking-wider transition disabled:opacity-50 ${
                    paid
                      ? "bg-tier-purple text-court-950 hover:brightness-110"
                      : "border border-court-500 text-court-100 hover:border-neon hover:text-neon"
                  }`}
                >
                  {setRole.isPending && setRole.variables === plan.role
                    ? "Switching…"
                    : paid
                      ? `Get ${ROLE_LABELS[plan.role]} · Free`
                      : "Switch to Free"}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="flex justify-center">
        <ErrorNote error={setRole.error} />
      </div>
      {role === "admin" && (
        <p className="text-center text-sm text-court-500">
          Admin accounts include everything. Change account types from the Admin page.
        </p>
      )}
      {!me.data?.selfUpgrade && !premium && (
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
