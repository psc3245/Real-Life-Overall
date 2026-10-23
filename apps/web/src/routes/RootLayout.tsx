import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useHealth } from "../api/hooks";
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
      {auth.signedIn && <TimezoneSync />}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
        <Link to="/" className="font-display text-2xl font-bold tracking-wider">
          <span className="text-neon">OVR</span>
          <span className="ml-2 text-sm font-medium tracking-[0.25em] text-court-300">
            REAL LIFE
          </span>
        </Link>
        {/* On phones the nav drops to its own full-width row below the logo and status. */}
        <nav
          className={`order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0 ${auth.signedIn ? "" : "invisible"}`}
          aria-label="Main"
          aria-hidden={!auth.signedIn}
        >
          {[
            ["/today", "Today"],
            ["/habits", "Habits"],
            ["/week", "Week"],
            ["/ratings", "My rating"],
            ["/friends", "Friends"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to!}
              className={({ isActive }) =>
                `whitespace-nowrap font-display text-sm uppercase tracking-wider ${isActive ? "text-neon" : "text-court-300 hover:text-court-100"}`
              }
            >
              {label}
              {to === "/friends" && requests > 0 && (
                <span
                  className="ml-1.5 rounded-full bg-neon px-1.5 text-xs text-court-950"
                  aria-label={`${requests} friend request${requests === 1 ? "" : "s"}`}
                >
                  {requests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span
            className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-court-500"
            title={apiUp ? "API reachable" : "API unreachable — is `npm run dev:api` running?"}
          >
            <span className={`h-2 w-2 rounded-full ${apiUp ? "bg-neon" : "bg-flare"}`} />
            API
          </span>
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
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
