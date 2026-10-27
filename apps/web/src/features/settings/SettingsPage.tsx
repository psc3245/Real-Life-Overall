import { LEADERBOARD_MIN_RECAPPED_DAYS, PROFILE_VISIBILITIES, USERNAME_PATTERN } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuthState } from "../../api/auth";
import { useMe, type Me } from "../../api/hooks";
import { useUpdateProfile } from "../../api/social";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { TrackingSettings } from "../body/TrackingSettings";
import { CopyLink } from "../social/CopyLink";
import { VISIBILITY_INFO } from "../social/visibility";
import { fieldClass } from "../../components/form";
import { DebugJson } from "../../components/debug/Debug";
import { useHashScroll } from "../../components/useHashScroll";
import { preferencesLink, type PreferencesTab } from "./PreferencesModal";
import { SignInSettings } from "./PasswordSettings";
import { Select, SettingBlock, SettingRow, SettingsCard, Toggle } from "./controls";

export function SettingsPage() {
  const me = useMe();
  const auth = useAuthState();
  useHashScroll(me.isSuccess);
  if (me.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (me.isError) return <ErrorNote error={me.error} />;

  const sections = [
    { id: "profile", label: "Profile" },
    ...(auth.mode === "better-auth" ? [{ id: "security", label: "Sign-in & security" }] : []),
    { id: "sharing", label: "Sharing" },
    { id: "units", label: "Units & body" },
    { id: "personalize", label: "Personalize" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-4">
      <h1 className="font-display text-4xl font-bold uppercase">Settings</h1>
      <div className="grid gap-6 md:grid-cols-[11rem_1fr] md:items-start">
        <nav
          aria-label="Settings sections"
          className="-mx-4 flex gap-4 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:flex-col md:gap-1 md:px-0"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap rounded-lg text-sm text-court-300 hover:text-neon md:px-3 md:py-1.5 md:hover:bg-court-900"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          <ProfileForm me={me.data} />
          {auth.mode === "better-auth" && <SignInSettings id="security" />}
          <SharingSection me={me.data} />
          <TrackingSettings me={me.data} id="units" />
          <PersonalizeLinks />
          <DebugJson label="me" data={me.data} />
        </div>
      </div>
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
    <SettingsCard id="profile" title="Profile" description="How you show up to other players.">
      <SettingBlock>
        <form onSubmit={onSubmit} className="space-y-4" aria-label="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
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
            </label>
          </div>
          <p className={`text-xs ${validUsername ? "text-court-500" : "text-flare"}`}>
            Your profile link is /u/{normalized || "…"}. 3-24 lowercase letters, digits, - or _.
          </p>
          <ErrorNote error={update.error} />
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
        </form>
      </SettingBlock>
    </SettingsCard>
  );
}

function SharingSection({ me }: { me: Me }) {
  const update = useUpdateProfile();
  const isPublic = me.profileVisibility === "public";
  return (
    <SettingsCard
      id="sharing"
      title="Sharing"
      description="Shared cards show your Overall, archetype, category ratings and catalog badges. Journals, recaps, attributes and the model's reasoning are never shared."
    >
      <SettingRow
        label="Who can see your card"
        detail={VISIBILITY_INFO[me.profileVisibility].detail}
        htmlFor="visibility"
      >
        <Select
          id="visibility"
          label="Who can see your card"
          value={me.profileVisibility}
          disabled={update.isPending}
          onChange={(profileVisibility) => update.mutate({ profileVisibility })}
          options={PROFILE_VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_INFO[v].label }))}
        />
      </SettingRow>
      <Toggle
        checked={me.leaderboardOptIn}
        // Unchecking always works; opting in needs a public profile.
        disabled={update.isPending || (!isPublic && !me.leaderboardOptIn)}
        onChange={(leaderboardOptIn) => update.mutate({ leaderboardOptIn })}
        label="Show me on global leaderboards"
        detail={
          isPublic
            ? `Ratings count once at least ${LEADERBOARD_MIN_RECAPPED_DAYS} days this season are recapped. Friends boards don't need this.`
            : "Global boards only include public profiles."
        }
      />
      <SettingRow label="Your profile" detail={`/u/${me.username}`}>
        {me.profileVisibility !== "private" && <CopyLink username={me.username} />}
        <Link
          to={`/u/${me.username}`}
          className="rounded-lg px-3 py-2 text-sm text-neon hover:bg-neon/10"
        >
          Preview →
        </Link>
      </SettingRow>
      {update.error && (
        <SettingBlock>
          <ErrorNote error={update.error} />
        </SettingBlock>
      )}
    </SettingsCard>
  );
}

const PERSONALIZE: { tab: PreferencesTab; label: string; detail: string }[] = [
  { tab: "look", label: "Look", detail: "Theme, colors, fonts and layout." },
  { tab: "today", label: "Today page", detail: "Greeting, layout and which widgets show." },
  { tab: "configuration", label: "Features", detail: "Switch whole parts of the app on or off." },
];

/** The look-and-feel preferences live in the Personalize modal; these open its tabs. */
function PersonalizeLinks() {
  return (
    <SettingsCard id="personalize" title="Personalize">
      {PERSONALIZE.map((p) => (
        <Link
          key={p.tab}
          to={preferencesLink(p.tab)}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-court-800/60"
        >
          <span>
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="block text-xs text-court-500">{p.detail}</span>
          </span>
          <span aria-hidden className="text-court-300">
            →
          </span>
        </Link>
      ))}
    </SettingsCard>
  );
}
