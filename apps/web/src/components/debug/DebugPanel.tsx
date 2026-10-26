import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import { useIsAdmin } from "../../api/admin";
import { useAuthState } from "../../api/auth";
import { api, requestLogStore } from "../../api/client";
import { useMe } from "../../api/hooks";
import { setDebugMode, useDebugSwitch } from "./debugMode";

const TABS = ["Requests", "Queries", "Page", "Session"] as const;
type Tab = (typeof TABS)[number];

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour12: false }) +
  `.${String(at % 1000).padStart(3, "0")}`;

/** Admin-only floating debug panel. Ctrl+Shift+D toggles inline debug info everywhere. */
export function DebugPanel() {
  const admin = useIsAdmin();
  const on = useDebugSwitch();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Requests");

  useEffect(() => {
    if (!admin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDebugMode(!on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [admin, on]);

  if (!admin) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Debug panel (Ctrl+Shift+D toggles inline debug)"
        className={`fixed bottom-4 left-4 z-30 rounded-full border px-3 py-1.5 font-mono text-xs shadow-lg ${on ? "border-tier-orange bg-court-900 text-tier-orange" : "border-court-700 bg-court-900 text-court-500"}`}
      >
        DBG{on ? "" : " (off)"}
      </button>
      {open && (
        <section
          aria-label="Debug panel"
          className="fixed bottom-14 left-4 z-30 flex max-h-[70dvh] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-tier-orange/60 bg-court-950/95 font-mono text-xs shadow-2xl backdrop-blur"
        >
          <header className="flex flex-wrap items-center gap-2 border-b border-court-800 px-3 py-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded px-2 py-0.5 ${tab === t ? "bg-tier-orange/20 text-tier-orange" : "text-court-300 hover:text-court-100"}`}
              >
                {t}
              </button>
            ))}
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-court-300">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="accent-[var(--color-tier-orange)]"
              />
              inline debug
            </label>
            <Link to="/admin" className="text-tier-orange hover:underline">
              admin →
            </Link>
          </header>
          <div className="overflow-auto p-3">
            {tab === "Requests" && <Requests />}
            {tab === "Queries" && <Queries />}
            {tab === "Page" && <Page />}
            {tab === "Session" && <Session />}
          </div>
        </section>
      )}
    </>
  );
}

function Requests() {
  const log = useSyncExternalStore(requestLogStore.subscribe, requestLogStore.get);
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-court-500">
        <span>{log.length} recent calls</span>
        <button type="button" onClick={requestLogStore.clear} className="hover:text-neon">
          clear
        </button>
      </div>
      <table className="w-full">
        <tbody>
          {log.map((r) => (
            <tr
              key={r.id}
              onClick={() => setOpenId(openId === r.id ? null : r.id)}
              className={`cursor-pointer align-top hover:bg-court-800/60 ${r.error ? "text-flare" : "text-court-300"}`}
            >
              <td className="pr-2 whitespace-nowrap text-court-500">{time(r.at)}</td>
              <td className="pr-2">{r.method}</td>
              <td className="max-w-0 w-full pr-2">
                <span className="block truncate">{r.path}</span>
                {openId === r.id && r.error && (
                  <span className="block whitespace-pre-wrap break-all text-flare">{r.error}</span>
                )}
              </td>
              <td className="pr-2">{r.status ?? "ERR"}</td>
              <td
                className={`pr-2 text-right whitespace-nowrap ${r.ms > 1000 ? "text-tier-orange" : ""}`}
              >
                {r.ms}ms
              </td>
              <td className="text-right whitespace-nowrap text-court-500">
                {r.size !== null ? `${(r.size / 1024).toFixed(1)}k` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Queries() {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  // getAll() returns a new array each time, so re-read it on cache events instead.
  const [queries, setQueries] = useState(() => cache.getAll());
  useEffect(() => cache.subscribe(() => setQueries(cache.getAll())), [cache]);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = queries.find((q) => q.queryHash === selected);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-court-500">
        <span>{queries.length} cached queries</span>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries()}
          className="hover:text-neon"
        >
          refetch all
        </button>
      </div>
      <ul className="space-y-0.5">
        {[...queries]
          .sort((a, b) => a.queryHash.localeCompare(b.queryHash))
          .map((q) => (
            <li key={q.queryHash}>
              <button
                type="button"
                onClick={() => setSelected(selected === q.queryHash ? null : q.queryHash)}
                className={`flex w-full justify-between gap-3 text-left hover:text-neon ${q.state.status === "error" ? "text-flare" : "text-court-300"}`}
              >
                <span className="truncate">{q.queryHash}</span>
                <span className="shrink-0 text-court-500">
                  {q.state.fetchStatus === "fetching" ? "fetching" : q.state.status}
                  {q.isStale() ? " · stale" : ""} · {q.getObserversCount()} obs
                  {q.state.dataUpdatedAt ? ` · ${time(q.state.dataUpdatedAt)}` : ""}
                </span>
              </button>
            </li>
          ))}
      </ul>
      {shown && (
        <pre className="max-h-64 overflow-auto rounded bg-court-900 p-2 text-[11px] text-court-300">
          {JSON.stringify(shown.state.data ?? shown.state.error, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Page() {
  const location = useLocation();
  return (
    <pre className="whitespace-pre-wrap text-court-300">
      {JSON.stringify(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: location.state as unknown,
          viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
          browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        null,
        2,
      )}
    </pre>
  );
}

function Session() {
  const me = useMe();
  const auth = useAuthState();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap text-court-300">
        {JSON.stringify(
          {
            me: me.data,
            authMode: auth.mode,
            apiUrl: import.meta.env.VITE_API_URL ?? "/api",
            viteMode: import.meta.env.MODE,
          },
          null,
          2,
        )}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-court-700 px-2 py-1 text-court-300 hover:border-tier-orange hover:text-tier-orange"
          onClick={() =>
            api("/dev/run-scheduled", { method: "POST" })
              .then((r) => setResult(JSON.stringify(r)))
              .catch((e: Error) => setResult(e.message))
          }
        >
          Run my 4am job now (dev only)
        </button>
      </div>
      {result && <pre className="whitespace-pre-wrap text-court-300">{result}</pre>}
    </div>
  );
}
