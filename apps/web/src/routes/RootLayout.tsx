import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useIsAdmin } from "../api/admin";
import { useHealth } from "../api/hooks";
import { DebugPanel } from "../components/debug/DebugPanel";
import { useAuthState, useSignOut } from "../api/auth";
import { useFriends } from "../api/social";
import { Button } from "../components/Button";
import { DevUserSwitcher } from "../components/DevUserSwitcher";
import { TimezoneSync } from "../components/TimezoneSync";

export function RootLayout() {
  const health = useHealth();
  const auth = useAuthState();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const apiUp = health.data?.ok === true;
  const friends = useFriends(auth.signedIn);
  const requests = friends.data?.incoming.length ?? 0;
  const admin = useIsAdmin();

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
      {auth.signedIn && <TimezoneSync />}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 pb-3">
        <Link to="/" className="font-display text-2xl font-bold tracking-wider">
          <span className="text-neon">OVR</span>
          <span className="ml-2 text-sm font-medium tracking-[0.25em] text-court-300">
            REAL LIFE
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span
            className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-court-500"
            title={apiUp ? "API reachable" : "API unreachable — is `npm run dev:api` running?"}
          >
            <span className={`h-2 w-2 rounded-full ${apiUp ? "bg-neon" : "bg-flare"}`} />
            API
          </span>
          {admin && (
            <Link
              to="/admin"
              className="rounded border border-dashed border-tier-orange/60 px-2 py-0.5 font-mono text-xs text-tier-orange hover:bg-tier-orange/10"
            >
              admin
            </Link>
          )}
          {auth.mode === "dev" && (
            <>
              <DevUserSwitcher />
              <Link to="/settings" className="text-sm text-court-300 hover:text-neon">
                Settings
              </Link>
            </>
          )}
          {auth.mode === "better-auth" &&
            (auth.signedIn ? (
              <span className="flex items-center gap-2 text-sm text-court-300">
                <Link
                  to="/settings"
                  className="hover:text-neon"
                  title="Profile and sharing settings"
                >
                  <span className="hidden sm:inline">{auth.name}</span>
                  <span className="sm:hidden">Settings</span>
                </Link>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  Sign out
                </Button>
              </span>
            ) : (
              <Link to="/signin" className="text-sm text-neon hover:underline">
                Sign in
              </Link>
            ))}
        </div>
      </header>
      {auth.signedIn && <MainNav requests={requests} />}
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <DebugPanel />
    </div>
  );
}

const side = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap font-display text-xs uppercase tracking-wider ${isActive ? "text-neon" : "text-court-300 hover:text-court-100"}`;

/**
 * Today anchors the left; Rating is the big centered button with smaller links either side.
 * Below lg it's one scrolling row in the same order.
 */
function MainNav({ requests }: { requests: number }) {
  return (
    <nav
      aria-label="Main"
      className="-mx-4 mb-4 flex items-center gap-5 overflow-x-auto border-y border-court-800/70 px-4 py-2.5 lg:mx-0 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:overflow-visible lg:rounded-full lg:border lg:px-5"
    >
      <div className="contents lg:flex lg:items-center lg:justify-between lg:gap-5">
        <NavLink
          to="/today"
          className={({ isActive }) =>
            `whitespace-nowrap font-display text-base font-semibold uppercase tracking-wider ${isActive ? "text-neon" : "text-court-100 hover:text-neon"}`
          }
        >
          Today
        </NavLink>
        <span className="contents lg:flex lg:gap-5">
          <NavLink to="/log" className={side}>
            Log
          </NavLink>
          <NavLink to="/habits" className={side}>
            Habits
          </NavLink>
          <NavLink to="/goals" className={side}>
            Goals
          </NavLink>
          <NavLink to="/workouts" className={side}>
            Train
          </NavLink>
          <NavLink to="/week" className={side}>
            Week
          </NavLink>
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
      <div className="contents lg:flex lg:items-center lg:gap-5">
        <NavLink to="/friends" className={side}>
          Friends
          {requests > 0 && (
            <span
              className="ml-1.5 rounded-full bg-neon px-1.5 text-[10px] text-court-950"
              aria-label={`${requests} friend request${requests === 1 ? "" : "s"}`}
            >
              {requests}
            </span>
          )}
        </NavLink>
        <NavLink to="/leaderboards" className={side}>
          Leaders
        </NavLink>
        <NavLink to="/charts" className={side}>
          Charts
        </NavLink>
        <NavLink to="/history" className={side}>
          History
        </NavLink>
      </div>
    </nav>
  );
}
