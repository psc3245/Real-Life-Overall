import {
  ADMIN_MIN_PASSWORD,
  ROLE_DETAILS,
  ROLE_LABELS,
  USER_ROLES,
  type AccountAction,
  type AdminUserDto,
  type UserRole,
} from "@rlo/shared";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  useAccountAction,
  useAdminUsers,
  useCreateAccount,
  useDeleteAccount,
  useSetRole,
} from "../../api/admin";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ROLE_STYLE, usd } from "./format";

/** What each action did, for the note under the buttons. */
const ACTION_DONE: Record<AccountAction, string> = {
  "verify-email": "Email marked confirmed. They can sign in now.",
  "resend-verification": "Confirmation email sent.",
  "send-password-reset": "Password reset email sent (the link lasts an hour).",
  "sign-out-everywhere": "Signed out on every device.",
};

/** A search box that waits for a pause in typing before it searches. */
function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Account management (DESIGN.md §8.7): search, sign (create), change type, fix sign-in, release. */
export function FrontOffice({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const [role, setRoleFilter] = useState<UserRole | "">("");
  const search = useDebounced(q.trim());
  const users = useAdminUsers({ q: search || undefined, role: role || undefined });
  const setRole = useSetRole();
  const [signing, setSigning] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const filtered = Boolean(search || role);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wider">
          Front office{" "}
          {users.data && (
            <span className="text-court-500">
              ({users.data.length}
              {filtered ? " found" : ""})
            </span>
          )}
        </h2>
        <Button variant={signing ? "ghost" : "secondary"} onClick={() => setSigning(!signing)}>
          {signing ? "Close" : "+ New account"}
        </Button>
      </div>

      {signing && <SignPlayer onDone={() => setSigning(false)} />}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, username or email"
          aria-label="Search accounts"
          className={`${compactFieldClass} min-w-0 flex-1 sm:max-w-sm`}
        />
        <select
          value={role}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
          aria-label="Filter by account type"
          className={compactFieldClass}
        >
          <option value="">All types</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <ErrorNote error={users.error ?? setRole.error} />
      <div className="overflow-x-auto rounded-xl border border-court-700 bg-court-900/70">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wider text-court-500">
            <tr>
              <th className="px-3 py-2 font-semibold">User</th>
              <th className="pr-3 font-semibold">Joined</th>
              <th className="pr-3 font-semibold">Last logged</th>
              <th className="pr-3 text-right font-semibold">LLM</th>
              <th className="pr-3 font-semibold">Account</th>
              <th className="pr-3" />
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isMe={u.id === myId}
                managing={managing === u.id}
                onManage={() => setManaging(managing === u.id ? null : u.id)}
                onRole={(r) => setRole.mutate({ id: u.id, role: r })}
                roleBusy={setRole.isPending}
              />
            ))}
            {users.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-court-500">
                  {filtered ? "No accounts match." : "No accounts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({
  user: u,
  isMe,
  managing,
  onManage,
  onRole,
  roleBusy,
}: {
  user: AdminUserDto;
  isMe: boolean;
  managing: boolean;
  onManage: () => void;
  onRole: (role: UserRole) => void;
  roleBusy: boolean;
}) {
  return (
    <>
      <tr className="border-t border-court-800">
        <td className="px-3 py-1.5">
          <span className="block">
            {u.displayName}
            {isMe && <span className="ml-2 text-xs text-court-500">(you)</span>}
          </span>
          <span className="block text-xs text-court-500">
            @{u.username} · {u.email} · {u.timezone}
          </span>
          <SignInChips user={u} />
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
            aria-label={`Account type for ${u.username}`}
            value={u.role}
            disabled={isMe || roleBusy}
            title={isMe ? "You can't change your own account type" : ROLE_DETAILS[u.role]}
            onChange={(e) => onRole(e.target.value as UserRole)}
            className={`rounded border bg-court-950 px-2 py-1 text-xs disabled:opacity-60 ${ROLE_STYLE[u.role]}`}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </td>
        <td className="pr-3 text-right">
          {!isMe && (
            <button
              type="button"
              onClick={onManage}
              aria-expanded={managing}
              className="rounded border border-court-700 px-2 py-1 text-xs uppercase tracking-wider text-court-300 hover:border-neon hover:text-neon"
            >
              {managing ? "Close" : "Manage"}
            </button>
          )}
        </td>
      </tr>
      {managing && (
        <tr className="bg-court-950/60">
          <td colSpan={6} className="px-3 py-3">
            <ManageAccount user={u} />
          </td>
        </tr>
      )}
    </>
  );
}

function SignInChips({ user: u }: { user: AdminUserDto }) {
  const chips: { label: string; className: string }[] = [];
  if (u.emailVerified === null) chips.push({ label: "No sign-in", className: "text-court-500" });
  if (u.emailVerified === false)
    chips.push({ label: "Unconfirmed", className: "border-tier-orange text-tier-orange" });
  if (u.signIn.includes("google")) chips.push({ label: "Google", className: "text-court-300" });
  if (!chips.length) return null;
  return (
    <span className="mt-0.5 flex gap-1">
      {chips.map((c) => (
        <span
          key={c.label}
          className={`rounded border border-court-700 px-1.5 text-[10px] uppercase tracking-wider ${c.className}`}
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

/** Sign-in fixes and deletion for one account. */
function ManageAccount({ user: u }: { user: AdminUserDto }) {
  const action = useAccountAction();
  const remove = useDeleteAccount();
  const [done, setDone] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const hasSignIn = u.emailVerified !== null;
  const run = (a: AccountAction) =>
    action.mutate({ id: u.id, action: a }, { onSuccess: () => setDone(ACTION_DONE[a]) });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-court-500">Sign-in</p>
        {hasSignIn ? (
          <div className="flex flex-wrap gap-2">
            {u.emailVerified === false && (
              <>
                <Button disabled={action.isPending} onClick={() => run("verify-email")}>
                  Confirm email
                </Button>
                <Button disabled={action.isPending} onClick={() => run("resend-verification")}>
                  Resend confirmation
                </Button>
              </>
            )}
            {u.signIn.length > 0 && (
              <Button disabled={action.isPending} onClick={() => run("send-password-reset")}>
                {u.signIn.includes("credential")
                  ? "Send password reset"
                  : "Email a set-password link"}
              </Button>
            )}
            <Button disabled={action.isPending} onClick={() => run("sign-out-everywhere")}>
              Sign out everywhere
            </Button>
          </div>
        ) : (
          <p className="text-sm text-court-500">
            A dev-mode player with no sign-in: nothing to manage.
          </p>
        )}
        {done && !action.isPending && <p className="text-sm text-neon">{done}</p>}
        <ErrorNote error={action.error} />
      </div>

      <form
        className="space-y-2"
        aria-label={`Delete ${u.username}`}
        onSubmit={(e) => {
          e.preventDefault();
          remove.mutate({ id: u.id, confirm });
        }}
      >
        <p className="text-xs uppercase tracking-wider text-flare">Release player</p>
        <p className="text-sm text-court-300">
          Deletes the account, its sign-in and every season, habit, log and rating. This can't be
          undone. Type <span className="font-mono text-court-100">{u.username}</span> to confirm.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-label={`Type ${u.username} to confirm`}
            autoComplete="off"
            className={`${compactFieldClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={confirm.trim().toLowerCase() !== u.username || remove.isPending}
            className="rounded-lg border border-flare px-3 py-2 text-sm text-flare hover:bg-flare/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {remove.isPending ? "Deleting…" : "Delete account"}
          </button>
        </div>
        <ErrorNote error={remove.error} />
      </form>
    </div>
  );
}

/** 16 characters a person can read back over the phone: no 0/O or 1/l. */
function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** "Sign a player": create an email + password account by hand. */
function SignPlayer({ onDone }: { onDone: () => void }) {
  const create = useCreateAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword);
  const [role, setRole] = useState<UserRole>("user");
  const [verified, setVerified] = useState(true);
  const [created, setCreated] = useState<{ user: AdminUserDto; verified: boolean } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, email, password, role, verified },
      {
        onSuccess: (user) => {
          setCreated({ user, verified });
          setName("");
          setEmail("");
          setPassword(generatePassword());
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      aria-label="New account"
      className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4"
    >
      <p className="text-xs uppercase tracking-wider text-court-500">Sign a player</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            className={`${compactFieldClass} w-full`}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            className={`${compactFieldClass} w-full`}
          />
        </Field>
        <Field label="Password" hint="Shown so you can pass it on. They can change it in Settings.">
          <div className="flex gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={ADMIN_MIN_PASSWORD}
              autoComplete="new-password"
              className={`${compactFieldClass} min-w-0 flex-1 font-mono`}
            />
            <Button variant="ghost" onClick={() => setPassword(generatePassword())}>
              New
            </Button>
          </div>
        </Field>
        <Field label="Account type" hint={ROLE_DETAILS[role]}>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={`${compactFieldClass} w-full`}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-court-300">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="accent-[var(--color-neon)]"
        />
        Email already confirmed (no confirmation email; they can sign in straight away)
      </label>
      <ErrorNote error={create.error} />
      {created && (
        <p className="text-sm text-neon">
          Signed @{created.user.username} ({ROLE_LABELS[created.user.role]}).{" "}
          {created.verified
            ? "They can sign in now."
            : `A confirmation email went to ${created.user.email}.`}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={create.isPending || password.length < ADMIN_MIN_PASSWORD}
        >
          {create.isPending ? "Creating…" : "Create account"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wider text-court-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-court-500">{hint}</span>}
    </label>
  );
}
