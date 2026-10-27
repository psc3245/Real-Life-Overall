import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useIsAdmin } from "../api/admin";
import { useHealth, useMe } from "../api/hooks";
import { useApplyPreferences, usePreferences } from "../api/preferences";
import { DebugPanel } from "../components/debug/DebugPanel";
import { useAuthState, useSignOut } from "../api/auth";
import { useFriends } from "../api/social";
import { Menu, MenuButton, MenuDivider, MenuLabel, MenuLink } from "../components/Menu";
import { DevUserSwitcher } from "../components/DevUserSwitcher";
import { TimezoneSync } from "../components/TimezoneSync";
import { preferencesLink, PreferencesModal } from "../features/settings/PreferencesModal";
import type { Feature, Preferences } from "@rlo/shared";
import { useTalk } from "../lib/talk";
import { OwnScoreProvider } from "../components/score";

const PAGE_WIDTH: Record<Preferences["pageWidth"], string> = {
  narrow: "max-w-3xl",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export function RootLayout() {
  const health = useHealth();
  const auth = useAuthState();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const apiUp = health.data?.ok === true;
  const admin = useIsAdmin();
  const me = useMe(auth.signedIn);
  useApplyPreferences();
  const prefs = usePreferences();
  const friends = useFriends(auth.signedIn && prefs.features.friends);
  const requests = friends.data?.incoming.length ?? 0;

  return (
    <div className={`mx-auto flex min-h-dvh ${PAGE_WIDTH[prefs.pageWidth]} flex-col px-4`}>
      {auth.signedIn && <TimezoneSync />}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 pb-3">
        <Link to="/" className="font-display text-2xl font-bold tracking-wider">
          <span className="text-neon">OVR</span>
          <span className="ml-2 text-sm font-medium tracking-[0.25em] text-court-300">
            REAL LIFE
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {(prefs.showApiStatus || !apiUp) && (
            <span
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-court-500"
              title={apiUp ? "API reachable" : "API unreachable — is `npm run dev:api` running?"}
            >
              <span className={`h-2 w-2 rounded-full ${apiUp ? "bg-neon" : "bg-flare"}`} />
              API
            </span>
          )}
          {auth.mode === "dev" && <DevUserSwitcher />}
          {auth.signedIn ? (
            <AccountMenu
              name={auth.name ?? me.data?.displayName ?? "Account"}
              username={me.data?.username}
              admin={admin}
              onSignOut={
                auth.mode === "better-auth"
                  ? async () => {
                      await signOut();
                      navigate("/");
                    }
                  : undefined
              }
            />
          ) : (
            auth.mode === "better-auth" && (
              <Link to="/signin" className="text-sm text-neon hover:underline">
                Sign in
              </Link>
            )
          )}
        </div>
      </header>
      {auth.signedIn && (
        <MainNav requests={requests} features={prefs.features} sticky={prefs.stickyNav} />
      )}
      <main className="flex-1 pb-16">
        <OwnScoreProvider enabled={auth.signedIn}>
          <Outlet />
        </OwnScoreProvider>
      </main>
      {auth.signedIn && <PreferencesModal />}
      <DebugPanel />
    </div>
  );
}

const side = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap font-display text-xs uppercase tracking-wider ${isActive ? "text-neon" : "text-court-300 hover:text-court-100"}`;
const groupTrigger = (active: boolean) =>
  `whitespace-nowrap font-display text-xs uppercase tracking-wider ${active ? "text-neon" : "text-court-300 hover:text-court-100"}`;

interface NavItem {
  to: string;
  label: string;
  detail: string;
  badge?: number;
}

/**
 * A dropdown of related pages. Lit when you're on one of them; a single item shows as a plain
 * link and an empty group (everything switched off) disappears.
 */
function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation();
  if (!items.length) return null;
  if (items.length === 1) {
    const [only] = items;
    return (
      <NavLink to={only!.to} className={side}>
        {only!.label}
        {only!.badge ? <CountPill count={only!.badge} /> : null}
      </NavLink>
    );
  }
  const active = items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  const badge = items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
  return (
    <Menu
      triggerClassName={groupTrigger(active)}
      trigger={
        <>
          {label}
          {badge > 0 && <CountPill count={badge} />}
        </>
      }
    >
      {items.map((i) => (
        <MenuLink key={i.to} to={i.to} detail={i.detail} badge={i.badge}>
          {i.label}
        </MenuLink>
      ))}
    </Menu>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span
      className="ml-1.5 rounded-full bg-neon px-1.5 text-[10px] text-court-950"
      aria-label={`${count} friend request${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

/**
 * Today anchors the left; Rating is the big centered button with the rest either side. Related
 * pages share a dropdown (Playbook, League, Stats). Below lg it's one row in the same order.
 */
function MainNav({
  requests,
  features,
  sticky,
}: {
  requests: number;
  features: Record<Feature, boolean>;
  sticky: boolean;
}) {
  const talk = useTalk();
  const on = (items: (NavItem & { feature: Feature })[]) =>
    items.filter((i) => features[i.feature]);
  const plan = on([
    { feature: "habits", to: "/habits", label: "Habits", detail: "Today's habits and streaks" },
    { feature: "goals", to: "/goals", label: "Goals", detail: "Targets with a deadline" },
    {
      feature: "workouts",
      to: "/workouts",
      label: talk.nav.workouts,
      detail: "Workouts, templates and records",
    },
  ]);
  const social = on([
    {
      feature: "friends",
      to: "/friends",
      label: "Friends",
      detail: "Requests and side-by-side compare",
      badge: requests,
    },
    {
      feature: "leaderboards",
      to: "/leaderboards",
      label: talk.nav.leaderboards,
      detail: "Friends and global boards",
    },
  ]);
  const stats = on([
    { feature: "charts", to: "/charts", label: "Charts", detail: "Explore any metric over time" },
    { feature: "reports", to: "/reports", label: "Reports", detail: "Chart sets with write-ups" },
    { feature: "history", to: "/history", label: "History", detail: "Past seasons" },
  ]);
  return (
    <nav
      aria-label="Main"
      className={`-mx-4 mb-4 flex items-center gap-5 overflow-x-auto border-y border-court-800/70 px-4 py-2.5 lg:mx-0 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:overflow-visible lg:rounded-full lg:border lg:px-5 ${sticky ? "sticky top-0 z-30 bg-court-950/90 backdrop-blur" : ""}`}
    >
      <div className="contents lg:flex lg:items-center lg:justify-between lg:gap-5">
        <NavLink
          to="/today"
          className={({ isActive }) =>
            `whitespace-nowrap font-display text-base font-semibold uppercase tracking-wider ${isActive ? "text-neon" : "text-court-100 hover:text-neon"}`
          }
        >
          {talk.nav.today}
        </NavLink>
        <span className="contents lg:flex lg:gap-5">
          <NavLink to="/log" className={side}>
            Log
          </NavLink>
          <NavGroup label={talk.nav.plan} items={plan} />
          {features.week && (
            <NavLink to="/week" className={side}>
              {talk.nav.week}
            </NavLink>
          )}
          {features.coach && (
            <NavLink to="/coach" className={side}>
              {talk.coach}
            </NavLink>
          )}
        </span>
      </div>
      <NavLink
        to="/ratings"
        className={({ isActive }) =>
          `whitespace-nowrap rounded-full border-2 border-neon px-6 py-1.5 font-display text-lg font-bold uppercase tracking-[0.2em] shadow-[0_0_18px_-6px_var(--color-neon)] transition ${isActive ? "bg-neon text-court-950" : "text-neon hover:bg-neon/10"}`
        }
      >
        Rating
      </NavLink>
      <div className="contents lg:flex lg:items-center lg:justify-end lg:gap-5">
        <NavGroup label={talk.nav.social} items={social} />
        <NavGroup label={talk.nav.stats} items={stats} />
      </div>
    </nav>
  );
}

/** Name in the header; opens profile, settings, personalize, admin and sign out. */
function AccountMenu({
  name,
  username,
  admin,
  onSignOut,
}: {
  name: string;
  username?: string;
  admin: boolean;
  onSignOut?: () => void;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Menu
      align="end"
      label={`Account menu for ${name}`}
      triggerClassName="rounded-full py-0.5 pr-2 pl-0.5 text-sm text-court-300 hover:text-court-100"
      trigger={
        <>
          <span className="grid h-7 w-7 place-items-center rounded-full border border-neon/60 bg-neon/10 font-display text-xs font-semibold text-neon">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        </>
      }
    >
      <MenuLabel>{username ? `@${username}` : name}</MenuLabel>
      {username && (
        <MenuLink to={`/u/${username}`} detail="How other players see your card">
          Your profile
        </MenuLink>
      )}
      <MenuLink to="/settings" detail="Account, password, sharing, units">
        Settings
      </MenuLink>
      <MenuLink to={preferencesLink()} detail="Theme, Today page, features">
        Personalize
      </MenuLink>
      {admin && (
        <MenuLink to="/admin" detail="Admin tools">
          Admin
        </MenuLink>
      )}
      {onSignOut && (
        <>
          <MenuDivider />
          <MenuButton onSelect={onSignOut}>Sign out</MenuButton>
        </>
      )}
    </Menu>
  );
}
