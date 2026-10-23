import { BADGE_TIER_LABELS } from "@rlo/shared";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { useProfile } from "../../api/social";
import { Medallion } from "../../components/BadgeChip";
import { PublicCard } from "../../components/PlayerCard";
import { ErrorNote } from "../onboarding/ErrorNote";
import { CopyLink } from "./CopyLink";
import { FriendButtons } from "./FriendButtons";
import { instantMonthYear } from "../../lib/format";

export const VISIBILITY_LABEL = {
  private: "Private: only you",
  friends: "Friends only",
  public: "Public: anyone with the link",
} as const;

/** A player's shared card at /u/:username. Signed-out visitors can open public ones. */
export function ProfilePage() {
  const { username = "" } = useParams();
  const profile = useProfile(username);

  if (profile.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.status === 404) {
      return (
        <div className="pt-16 text-center">
          <p className="font-display text-3xl uppercase">Profile not available</p>
          <p className="mt-2 text-court-300">
            This player doesn't exist or hasn't shared their card with you.
          </p>
          <Link to="/" className="mt-6 inline-block text-neon hover:underline">
            Back to home
          </Link>
        </div>
      );
    }
    return <ErrorNote error={profile.error} />;
  }

  const p = profile.data;
  return (
    <div className="space-y-8 pt-4">
      {p.isSelf && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-court-700 bg-court-900/60 px-4 py-3 text-sm">
          <span className="text-court-300">
            This is how other players see your card. Visibility:{" "}
            <span className="text-court-100">{VISIBILITY_LABEL[p.visibility ?? "private"]}</span>
          </span>
          <span className="flex items-center gap-3">
            {p.visibility !== "private" && <CopyLink username={p.username} />}
            <Link to="/settings" className="text-neon hover:underline">
              Sharing settings
            </Link>
          </span>
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-start">
        {p.card ? (
          <PublicCard card={p.card} name={p.displayName} />
        ) : (
          <section className="rounded-2xl border border-court-700 bg-court-900/80 p-6">
            <p className="font-display text-2xl font-semibold uppercase">{p.displayName}</p>
            <p className="mt-2 text-court-300">No rating yet.</p>
          </section>
        )}
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase">{p.displayName}</h1>
            <p className="text-court-500">
              @{p.username} · joined {instantMonthYear(p.memberSince)}
            </p>
          </div>
          {p.friendship && (
            <FriendButtons
              username={p.username}
              state={p.friendship}
              canCompare={Boolean(p.card)}
            />
          )}
          {!p.isSelf && !p.friendship && (
            <Link to="/signin" className="inline-block text-sm text-neon hover:underline">
              Sign in to add {p.displayName} as a friend
            </Link>
          )}
          <section aria-label="Badges">
            <h2 className="mb-2 text-xs uppercase tracking-wider text-court-300">Badges</h2>
            {p.badges.length ? (
              <ul className="flex flex-wrap gap-3">
                {p.badges.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-center gap-2 rounded-lg border border-court-800 px-3 py-2"
                  >
                    <Medallion tier={b.tier} size={26} />
                    <span className="text-sm">
                      {b.name}
                      <span className="text-court-500"> · {BADGE_TIER_LABELS[b.tier]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-court-500">None yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
