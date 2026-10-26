import {
  LEADERBOARD_MIN_RECAPPED_DAYS,
  PROFILE_VISIBILITIES,
  USERNAME_PATTERN,
  type ProfileVisibility,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMe, type Me } from "../../api/hooks";
import { useUpdateProfile } from "../../api/social";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { TrackingSettings } from "../body/TrackingSettings";
import { CopyLink } from "../social/CopyLink";
import { VISIBILITY_LABEL } from "../social/ProfilePage";
import { fieldClass } from "../../components/form";
import { DebugJson } from "../../components/debug/Debug";
import { useHashScroll } from "../../components/useHashScroll";
import { preferencesLink } from "./PreferencesModal";

const VISIBILITY_DETAIL: Record<ProfileVisibility, string> = {
  private: "Nobody else can open your profile.",
  friends: "Players you've accepted as friends can see your card.",
  public: "Anyone with your link can see your card, signed in or not.",
};

export function SettingsPage() {
  const me = useMe();
  useHashScroll(me.isSuccess);
  if (me.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (me.isError) return <ErrorNote error={me.error} />;
  return (
    <div className="mx-auto max-w-xl space-y-10 pt-4">
      <h1 className="font-display text-4xl font-bold uppercase">Settings</h1>
      <ProfileForm me={me.data} />
      <Link
        to={preferencesLink()}
        className="flex items-center justify-between gap-3 rounded-lg border border-court-700 px-4 py-3 hover:border-neon"
      >
        <span>
          <span className="block font-medium">Personalize</span>
          <span className="block text-sm text-court-500">
            Theme, colors and fonts, the Today page, and which parts of the app are on. Also on your
            profile page.
          </span>
        </span>
        <span className="text-neon">→</span>
      </Link>
      <div id="units" className="scroll-mt-16">
        <TrackingSettings me={me.data} />
      </div>
      <div id="sharing" className="scroll-mt-16">
        <SharingSection me={me.data} />
      </div>
      <DebugJson label="me" data={me.data} />
    </div>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const normalized = username.trim().toLowerCase();
  const validUsername = USERNAME_PATTERN.test(normalized);
  const dirty = displayName.trim() !== me.displayName || normalized !== me.username;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({
      ...(displayName.trim() !== me.displayName && { displayName: displayName.trim() }),
      ...(normalized !== me.username && { username: normalized }),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Profile">
      <h2 className="font-display text-xl uppercase tracking-wider">Profile</h2>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wider text-court-300">Display name</span>
        <input
          value={displayName}
          required
          maxLength={40}
          onChange={(e) => setDisplayName(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wider text-court-300">Username</span>
        <input
          value={username}
          required
          maxLength={24}
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setUsername(e.target.value)}
          className={fieldClass}
          aria-invalid={!validUsername}
        />
        <span className={`text-xs ${validUsername ? "text-court-500" : "text-flare"}`}>
          Your profile link is /u/{normalized || "…"}. 3-24 lowercase letters, digits, - or _.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!dirty || !validUsername || !displayName.trim() || update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        {update.isSuccess && !dirty && <span className="text-sm text-neon">Saved</span>}
      </div>
      <ErrorNote error={update.error} />
    </form>
  );
}

function SharingSection({ me }: { me: Me }) {
  const update = useUpdateProfile();
  return (
    <section className="space-y-4" aria-label="Sharing">
      <h2 className="font-display text-xl uppercase tracking-wider">Sharing</h2>
      <p className="text-sm text-court-300">
        Shared cards show your Overall, archetype, category ratings and catalog badges. Journals,
        recaps, attributes and the model's reasoning are never shared.
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Who can see your card</legend>
        {PROFILE_VISIBILITIES.map((v) => (
          <label
            key={v}
            className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 ${me.profileVisibility === v ? "border-neon bg-neon/5" : "border-court-700 hover:border-court-500"}`}
          >
            <input
              type="radio"
              name="visibility"
              value={v}
              checked={me.profileVisibility === v}
              disabled={update.isPending}
              onChange={() => update.mutate({ profileVisibility: v })}
              className="mt-1 accent-[var(--color-neon)]"
            />
            <span>
              <span className="block font-medium">{VISIBILITY_LABEL[v]}</span>
              <span className="block text-sm text-court-500">{VISIBILITY_DETAIL[v]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label
        className={`flex gap-3 rounded-lg border border-court-700 px-4 py-3 ${me.profileVisibility === "public" ? "cursor-pointer" : "opacity-60"}`}
      >
        <input
          type="checkbox"
          checked={me.leaderboardOptIn}
          // Unchecking always works; opting in needs a public profile.
          disabled={update.isPending || (me.profileVisibility !== "public" && !me.leaderboardOptIn)}
          onChange={(e) => update.mutate({ leaderboardOptIn: e.target.checked })}
          className="mt-1 accent-[var(--color-neon)]"
        />
        <span>
          <span className="block font-medium">Show me on global leaderboards</span>
          <span className="block text-sm text-court-500">
            {me.profileVisibility === "public"
              ? `Ratings count once at least ${LEADERBOARD_MIN_RECAPPED_DAYS} days this season are recapped. Friends boards don't need this.`
              : "Global boards only include public profiles."}
          </span>
        </span>
      </label>
      <ErrorNote error={update.error} />
      <div className="flex flex-wrap items-center gap-4">
        {me.profileVisibility !== "private" && <CopyLink username={me.username} />}
        <Link to={`/u/${me.username}`} className="text-sm text-neon hover:underline">
          Preview your profile →
        </Link>
      </div>
    </section>
  );
}
