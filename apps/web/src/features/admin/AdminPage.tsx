import { USER_ROLES, type LlmCallDto, type UsageRowDto, type UserRole } from "@rlo/shared";
import { useState } from "react";
import { Navigate } from "react-router";
import {
  useAdminOverview,
  useAdminUsers,
  useIsAdmin,
  useLlmCalls,
  useSetRole,
} from "../../api/admin";
import { useMe } from "../../api/hooks";
import { StatTile } from "../../components/StatTile";
import { SectionNav } from "../../components/SectionNav";
import { ErrorNote } from "../onboarding/ErrorNote";

const usd = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Usage, costs, LLM calls and accounts (DESIGN.md §8.7). Admins only. */
export function AdminPage() {
  const me = useMe();
  const admin = useIsAdmin();
  if (me.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (!admin) return <Navigate to="/" replace />;
  return (
    <div className="space-y-10 pt-4">
      <header>
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-tier-orange">Admin</p>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Control room</h1>
      </header>
      <SectionNav
        sections={[
          { id: "usage", label: "Usage" },
          { id: "calls", label: "LLM calls" },
          { id: "users", label: "Users" },
        ]}
      />
      <div id="usage" className="scroll-mt-16">
        <Usage />
      </div>
      <div id="calls" className="scroll-mt-16">
        <Calls />
      </div>
      <div id="users" className="scroll-mt-16">
        <Users myId={me.data!.id} />
      </div>
    </div>
  );
}

function Usage() {
  const overview = useAdminOverview();
  if (overview.isPending) return <p className="text-court-500">Loading…</p>;
  if (overview.isError) return <ErrorNote error={overview.error} />;
  const o = overview.data;
  const maxDay = Math.max(0.0001, ...o.byDay.map((d) => d.costUsd));
  return (
    <section className="space-y-5">
      <h2 className="font-display text-xl uppercase tracking-wider">Usage</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Users"
          value={o.users}
          detail={`${o.admins} admin${o.admins === 1 ? "" : "s"}`}
        />
        <StatTile label="Active 7d" value={o.activeUsers7d} detail="logged a day" />
        <StatTile label="Active seasons" value={o.activeSeasons} />
        {o.windows.map((w) => (
          <StatTile
            key={w.label}
            label={`LLM ${w.label}`}
            value={usd(w.costUsd)}
            detail={`${w.calls} calls${w.errors ? ` · ${w.errors} errors` : ""}`}
          />
        ))}
      </dl>

      {o.byDay.some((d) => d.calls > 0) && (
        <div className="rounded-xl border border-court-700 bg-court-900/70 p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-court-500">
            Daily LLM cost, last 30 days (UTC)
          </p>
          <div className="flex h-28 items-end gap-1" role="img" aria-label="Daily LLM cost">
            {o.byDay.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${usd(d.costUsd)}, ${d.calls} calls`}
                className="flex-1 rounded-t bg-neon/70 hover:bg-neon"
                style={{ height: d.calls ? `${Math.max(3, (100 * d.costUsd) / maxDay)}%` : "1px" }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageTable title="By purpose (30d)" rows={o.byPurpose} />
        <UsageTable title="By model (30d)" rows={o.byModel} />
      </div>

      {o.recentErrors.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider text-flare">
            Recent errors
          </h3>
          <CallTable calls={o.recentErrors} />
        </div>
      )}
    </section>
  );
}

function UsageTable({ title, rows }: { title: string; rows: UsageRowDto[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-court-700 bg-court-900/70 p-4">
      <p className="mb-2 text-xs uppercase tracking-wider text-court-500">{title}</p>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-[11px] uppercase tracking-wider text-court-500">
          <tr>
            <th className="pr-3 font-semibold">Key</th>
            <th className="pr-3 text-right font-semibold">Calls</th>
            <th className="pr-3 text-right font-semibold">Err</th>
            <th className="pr-3 text-right font-semibold">Tokens in/out</th>
            <th className="pr-3 text-right font-semibold">Avg ms</th>
            <th className="text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-court-800">
              <td className="py-1 pr-3 font-mono text-xs">{r.key}</td>
              <td className="pr-3 text-right">{r.calls}</td>
              <td className={`pr-3 text-right ${r.errors ? "text-flare" : "text-court-500"}`}>
                {r.errors}
              </td>
              <td className="pr-3 text-right text-court-300">
                {r.inputTokens.toLocaleString()}/{r.outputTokens.toLocaleString()}
              </td>
              <td className="pr-3 text-right text-court-300">{r.avgLatencyMs}</td>
              <td className="text-right">{usd(r.costUsd)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-center text-court-500">
                No calls yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Calls() {
  const [errorsOnly, setErrorsOnly] = useState(false);
  const calls = useLlmCalls({ errorsOnly, limit: 100 });
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wider">LLM calls</h2>
        <label className="flex items-center gap-2 text-sm text-court-300">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
            className="accent-[var(--color-neon)]"
          />
          Errors only
        </label>
      </div>
      <ErrorNote error={calls.error} />
      {calls.data && <CallTable calls={calls.data} />}
    </section>
  );
}

function CallTable({ calls }: { calls: LlmCallDto[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-xl border border-court-700 bg-court-900/70">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-[11px] uppercase tracking-wider text-court-500">
          <tr>
            <th className="px-3 py-2 font-semibold">When</th>
            <th className="pr-3 font-semibold">User</th>
            <th className="pr-3 font-semibold">Purpose</th>
            <th className="pr-3 font-semibold">Model</th>
            <th className="pr-3 text-right font-semibold">Tokens</th>
            <th className="pr-3 text-right font-semibold">ms</th>
            <th className="pr-3 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr
              key={c.id}
              onClick={() => setOpen(open === c.id ? null : c.id)}
              className={`cursor-pointer border-t border-court-800 align-top hover:bg-court-800/50 ${c.error ? "text-flare" : ""}`}
            >
              <td className="px-3 py-1.5 whitespace-nowrap text-court-300">{when(c.createdAt)}</td>
              <td className="pr-3">{c.username ?? "—"}</td>
              <td className="pr-3 font-mono text-xs">
                {c.purpose}
                <span className="block text-court-500">{c.promptVersion}</span>
                {open === c.id && c.error && (
                  <span className="block max-w-md whitespace-pre-wrap break-words text-flare">
                    {c.error}
                  </span>
                )}
              </td>
              <td className="pr-3 font-mono text-xs text-court-300">{c.model}</td>
              <td className="pr-3 text-right text-court-300">
                {c.inputTokens ?? "—"}/{c.outputTokens ?? "—"}
              </td>
              <td
                className={`pr-3 text-right ${c.latencyMs > 10_000 ? "text-tier-orange" : "text-court-300"}`}
              >
                {c.latencyMs.toLocaleString()}
              </td>
              <td className="pr-3 text-right">{c.costUsd !== null ? usd(c.costUsd) : "—"}</td>
            </tr>
          ))}
          {calls.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-court-500">
                Nothing here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Users({ myId }: { myId: string }) {
  const users = useAdminUsers();
  const setRole = useSetRole();
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl uppercase tracking-wider">
        Users {users.data && <span className="text-court-500">({users.data.length})</span>}
      </h2>
      <ErrorNote error={users.error ?? setRole.error} />
      <div className="overflow-x-auto rounded-xl border border-court-700 bg-court-900/70">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wider text-court-500">
            <tr>
              <th className="px-3 py-2 font-semibold">User</th>
              <th className="pr-3 font-semibold">Joined</th>
              <th className="pr-3 font-semibold">Last logged</th>
              <th className="pr-3 text-right font-semibold">LLM</th>
              <th className="pr-3 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-court-800">
                <td className="px-3 py-1.5">
                  <span className="block">{u.displayName}</span>
                  <span className="block text-xs text-court-500">
                    @{u.username} · {u.email} · {u.timezone}
                  </span>
                </td>
                <td className="pr-3 whitespace-nowrap text-court-300">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="pr-3 whitespace-nowrap text-court-300">{u.lastLogged ?? "—"}</td>
                <td className="pr-3 text-right text-court-300">
                  {u.llmCalls} · {usd(u.costUsd)}
                </td>
                <td className="pr-3">
                  <select
                    aria-label={`Role for ${u.username}`}
                    value={u.role}
                    disabled={u.id === myId || setRole.isPending}
                    title={u.id === myId ? "You can't change your own role" : undefined}
                    onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as UserRole })}
                    className={`rounded border bg-court-950 px-2 py-1 text-xs disabled:opacity-60 ${u.role === "admin" ? "border-tier-orange text-tier-orange" : "border-court-700"}`}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
