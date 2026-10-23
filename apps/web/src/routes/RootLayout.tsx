import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useHealth } from "../api/hooks";
import { useAuthState, useSignOut } from "../api/auth";
import { Button } from "../components/Button";
import { DevUserSwitcher } from "../components/DevUserSwitcher";
import { TimezoneSync } from "../components/TimezoneSync";

export function RootLayout() {
  const health = useHealth();
  const auth = useAuthState();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const apiUp = health.data?.ok === true;

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
          className={`order-last flex w-full gap-5 sm:order-none sm:w-auto ${auth.signedIn ? "" : "invisible"}`}
          aria-label="Main"
          aria-hidden={!auth.signedIn}
        >
          {[
            ["/today", "Today"],
            ["/habits", "Habits"],
            ["/week", "Week"],
            ["/ratings", "My rating"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to!}
              className={({ isActive }) =>
                `whitespace-nowrap font-display text-sm uppercase tracking-wider ${isActive ? "text-neon" : "text-court-300 hover:text-court-100"}`
              }
            >
              {label}
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
