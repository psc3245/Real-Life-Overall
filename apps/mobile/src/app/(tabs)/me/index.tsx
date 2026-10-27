import { useIsAdmin } from "@/api/admin";
import { useMe } from "@/api/hooks";
import { usePreferences } from "@/api/preferences";
import { useFriends } from "@/api/social";
import { NavRow, SettingsGroup } from "@/components/settings";
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { useTalk } from "@/lib/talk";

/**
 * Your player: everything the web keeps in its League and Stats menus and the account menu
 * (profile, settings, personalize, admin), as grouped rows.
 */
export default function MeScreen() {
  const talk = useTalk();
  const me = useMe();
  const { features } = usePreferences();
  const friends = useFriends(features.friends);
  const admin = useIsAdmin();

  if (me.isPending) return <Loading title="You" />;
  if (me.isError) {
    return (
      <Screen title="You" onRefresh={() => me.refetch()}>
        <ErrorNote error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  const requests = friends.data?.incoming.length ?? 0;
  const league = [
    features.friends && {
      icon: "person.2" as const,
      label: "Friends",
      detail: "Requests and side-by-side compare",
      href: "/friends" as const,
      badge: requests,
    },
    features.leaderboards && {
      icon: "trophy" as const,
      label: talk.nav.leaderboards,
      detail: "Friends and global boards",
      href: "/leaderboards" as const,
    },
  ].filter((x) => x !== false);
  const stats = [
    features.charts && {
      icon: "chart.xyaxis.line" as const,
      label: "Charts",
      detail: "Explore any metric over time",
      href: "/charts" as const,
    },
    features.reports && {
      icon: "doc.text.magnifyingglass" as const,
      label: "Reports",
      detail: "Chart sets with write-ups",
      href: "/reports" as const,
    },
    features.history && {
      icon: "clock.arrow.circlepath" as const,
      label: "Season history",
      detail: "Past seasons",
      href: "/history" as const,
    },
    {
      icon: "list.bullet.rectangle" as const,
      label: "Rating activity",
      detail: "Every rating change",
      href: "/activity" as const,
    },
  ].filter((x) => x !== false);

  return (
    <Screen
      eyebrow={`@${me.data.username}`}
      title={me.data.displayName}
      onRefresh={() => Promise.all([me.refetch(), friends.refetch()])}
    >
      <SettingsGroup>
        <NavRow
          icon="person.text.rectangle"
          label="Your profile"
          detail="How other players see your card"
          href={{ pathname: "/u/[username]", params: { username: me.data.username } }}
        />
        <NavRow
          icon="scope"
          label={talk.scoutingReport}
          detail={talk.scoutingReportTagline}
          href="/scouting-report"
        />
        {features.coach && (
          <NavRow
            icon="bubble.left.and.text.bubble.right"
            label={talk.coach}
            detail={talk.coachTagline}
            href="/coach"
          />
        )}
        <NavRow icon="figure" label="Body" detail="Height and weight" href="/body" last />
      </SettingsGroup>

      {league.length > 0 && (
        <SettingsGroup title={talk.nav.social}>
          {league.map((r, i) => (
            <NavRow key={r.href} {...r} last={i === league.length - 1} />
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title={talk.nav.stats}>
        {stats.map((r, i) => (
          <NavRow key={r.href} {...r} last={i === stats.length - 1} />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Account">
        <NavRow
          icon="gearshape"
          label="Settings"
          detail="Account, password, sharing, units"
          href="/settings"
        />
        <NavRow
          icon="paintbrush"
          label="Personalize"
          detail="Sports talk, Today page, features"
          href="/personalize"
        />
        {features.habits && (
          <NavRow icon="slider.horizontal.3" label="Manage habits" href="/habits/manage" />
        )}
        {admin ? (
          <NavRow
            icon="wrench.and.screwdriver"
            label="Admin"
            detail="Admin tools"
            href="/admin"
            last
          />
        ) : null}
      </SettingsGroup>
    </Screen>
  );
}
