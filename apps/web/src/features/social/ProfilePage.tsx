import { BADGE_TIER_LABELS, PROFILE_VISIBILITIES, type ProfileVisibility } from "@rlo/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { useProfile, useUpdateProfile } from "../../api/social";
import { Medallion } from "../../components/BadgeChip";
import { PublicCard } from "../../components/PlayerCard";
import { ErrorNote } from "../onboarding/ErrorNote";
import { Menu, MenuButton, MenuLabel, MenuLink } from "../../components/Menu";
import { profileUrl } from "./CopyLink";
import { VISIBILITY_INFO } from "./visibility";
import { FriendButtons } from "./FriendButtons";
import { instantMonthYear } from "../../lib/format";
import { DebugJson } from "../../components/debug/Debug";
import { preferencesLink } from "../settings/PreferencesModal";

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
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-court-800 pb-5">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold uppercase">{p.displayName}</h1>
          <p className="text-court-500">
            @{p.username} · joined {instantMonthYear(p.memberSince)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {p.isSelf ? (
            <SelfActions username={p.username} visibility={p.visibility ?? "private"} />
          ) : p.friendship ? (
            <FriendButtons
              username={p.username}
              state={p.friendship}
              canCompare={Boolean(p.card)}
            />
          ) : (
            <Link to="/signin" className="text-sm text-neon hover:underline">
              Sign in to add {p.displayName} as a friend
            </Link>
          )}
        </div>
      </header>
      {p.isSelf && (
        <p className="text-sm text-court-500">This is how other players see your card.</p>
      )}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {p.card ? (
          <PublicCard card={p.card} name={p.displayName} />
        ) : (
          <section className="rounded-2xl border border-court-700 bg-court-900/80 p-6">
            <p className="font-display text-2xl font-semibold uppercase">{p.displayName}</p>
            <p className="mt-2 text-court-300">No rating yet.</p>
          </section>
        )}
        <section
          aria-label="Badges"
          className="rounded-2xl border border-court-700 bg-court-900/60 p-5"
        >
          <h2 className="mb-3 flex items-baseline justify-between font-display text-base font-semibold uppercase tracking-wider">
            Badges
            <span className="text-sm font-normal text-court-500">{p.badges.length}</span>
          </h2>
          {p.badges.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {p.badges.map((b) => (
                <li
                  key={b.key}
                  className="flex items-center gap-3 rounded-lg border border-court-800 bg-court-950/40 px-3 py-2"
                >
                  <Medallion tier={b.tier} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{b.name}</span>
                    <span className="block text-xs text-court-500">
                      {BADGE_TIER_LABELS[b.tier]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-court-500">None yet.</p>
          )}
        </section>
      </div>
      <DebugJson label="profile" data={profile.data} />
    </div>
  );
}

/** On your own card: who can see it (changeable right here) and a menu for the rest. */
function SelfActions({
  username,
  visibility,
}: {
  username: string;
  visibility: ProfileVisibility;
}) {
  const update = useUpdateProfile();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl(username));
      setCopied(true);
    } catch {
      window.prompt("Copy your profile link", profileUrl(username));
    }
  };
  return (
    <>
      <Menu
        align="end"
        label={`Who can see your card: ${VISIBILITY_INFO[visibility].label}`}
        triggerClassName="rounded-lg border border-court-700 px-3 py-2 text-sm text-court-300 hover:border-court-500"
        trigger={
          <>
            <span className="text-court-500">Visible to</span>
            <span className="text-court-100">{VISIBILITY_INFO[visibility].label}</span>
          </>
        }
      >
        <MenuLabel>Who can see your card</MenuLabel>
        {PROFILE_VISIBILITIES.map((v) => (
          <MenuButton key={v} onSelect={() => update.mutate({ profileVisibility: v })}>
            <span className="w-4 text-neon">{v === visibility ? "✓" : ""}</span>
            <span className="min-w-0 flex-1">
              <span className="block">{VISIBILITY_INFO[v].label}</span>
              <span className="block text-xs text-court-500">{VISIBILITY_INFO[v].detail}</span>
            </span>
          </MenuButton>
        ))}
      </Menu>
      <Menu
        align="end"
        triggerClassName="rounded-lg border border-court-500 px-3 py-2 text-sm text-court-100 hover:border-neon hover:text-neon"
        trigger={copied ? "Link copied" : "Share & edit"}
      >
        {visibility !== "private" && <MenuButton onSelect={copy}>Copy profile link</MenuButton>}
        <MenuLink to="/settings#profile">Edit name and username</MenuLink>
        <MenuLink to="/settings#sharing">Sharing settings</MenuLink>
        <MenuLink to={preferencesLink()}>Personalize</MenuLink>
      </Menu>
    </>
  );
}
