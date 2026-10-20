import { Link, Outlet } from "react-router";
import { useHealth } from "../api/hooks";
import { DevUserSwitcher } from "../components/DevUserSwitcher";

export function RootLayout() {
  const health = useHealth();
  const apiUp = health.data?.ok === true;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
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
          <DevUserSwitcher />
        </div>
      </header>
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
