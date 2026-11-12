import {
  ADMIN_MIN_PASSWORD,
  ROLE_DETAILS,
  ROLE_LABELS,
  SEASON_MODE_LABELS,
  SEASON_MODES,
  seasonModeAllowed,
  USER_ROLES,
  type AccountAction,
  type AdminUserDto,
  type LlmCallDto,
  type UsageRowDto,
  type UserRole,
} from "@rlo/shared";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useBugReports, useSetBugReportStatus } from "@/api/bugReports";
import {
  useAccountAction,
  useAdminOverview,
  useAdminUsers,
  useCreateAccount,
  useDeleteAccount,
  useIsAdmin,
  useLlmCalls,
  useSetRole,
  useSetSeasonMode,
} from "@/api/admin";
import { useMe } from "@/api/hooks";
import { Chip, Segmented } from "@/components/controls";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Screen } from "@/components/ui";
import { colors, space, tierColor } from "@/lib/theme";

const roleColor = (role: UserRole) =>
  role === "admin" ? tierColor(65) : role === "dev" ? tierColor(95) : colors.neon;

const usd = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type Tab = "usage" | "calls" | "users" | "bugs";

/** Usage, costs, LLM calls and accounts (DESIGN.md §8.7). Admins only. */
export default function AdminScreen() {
  const me = useMe();
  const admin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("usage");
  if (me.isPending) return <Loading title="Admin" />;
  if (!admin) return <Redirect href="/today" />;
  return (
    <Screen eyebrow="Admin" title="Control room">
      <Segmented
        label="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "usage", label: "Usage" },
          { value: "calls", label: "LLM calls" },
          { value: "users", label: "Users" },
          { value: "bugs", label: "Bugs" },
        ]}
      />
      {tab === "usage" && <Usage />}
      {tab === "bugs" && <BugReports />}
      {tab === "calls" && <Calls />}
      {tab === "users" && <Users myId={me.data!.id} />}
    </Screen>
  );
}

function Usage() {
  const overview = useAdminOverview();
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorNote error={overview.error} />;
  const o = overview.data;
  const maxDay = Math.max(0.0001, ...o.byDay.map((d) => d.costUsd));
  return (
    <View style={{ gap: space.lg }}>
      <StatGrid>
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
      </StatGrid>
      {o.byDay.some((d) => d.calls > 0) && (
        <Card style={{ gap: space.sm }}>
          <Muted style={styles.caption}>Daily LLM cost, last 30 days (UTC)</Muted>
          <View style={styles.bars} accessibilityLabel="Daily LLM cost">
            {o.byDay.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.bar,
                  { height: d.calls ? `${Math.max(3, (100 * d.costUsd) / maxDay)}%` : 1 },
                ]}
              />
            ))}
          </View>
        </Card>
      )}
      <UsageRows title="By purpose (30d)" rows={o.byPurpose} />
      <UsageRows title="By model (30d)" rows={o.byModel} />
      {o.recentErrors.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label style={{ color: colors.flare }}>Recent errors</Label>
          <CallList calls={o.recentErrors} />
        </View>
      )}
    </View>
  );
}

function UsageRows({ title, rows }: { title: string; rows: UsageRowDto[] }) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{title}</Label>
      <Card style={{ padding: 0 }}>
        {rows.length === 0 && <Muted style={{ padding: space.lg }}>No calls yet.</Muted>}
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i > 0 && styles.border]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mono}>{r.key}</Text>
              <Muted style={{ fontSize: 12 }}>
                {r.calls} calls · {r.inputTokens.toLocaleString()}/{r.outputTokens.toLocaleString()}{" "}
                tok · {r.avgLatencyMs} ms
                {r.errors ? <Text style={{ color: colors.flare }}> · {r.errors} err</Text> : null}
              </Muted>
            </View>
            <Text style={styles.value}>{usd(r.costUsd)}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Calls() {
  const [errorsOnly, setErrorsOnly] = useState(false);
  const calls = useLlmCalls({ errorsOnly, limit: 100 });
  return (
    <View style={{ gap: space.md }}>
      <Segmented
        label="Filter"
        value={errorsOnly ? "errors" : "all"}
        onChange={(v) => setErrorsOnly(v === "errors")}
        options={[
          { value: "all", label: "All" },
          { value: "errors", label: "Errors only" },
        ]}
      />
      <ErrorNote error={calls.error} />
      {calls.isPending && <Loading />}
      {calls.data && <CallList calls={calls.data} />}
    </View>
  );
}

function CallList({ calls }: { calls: LlmCallDto[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card style={{ padding: 0 }}>
      {calls.length === 0 && <Muted style={{ padding: space.lg }}>Nothing here.</Muted>}
      {calls.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => setOpen(open === c.id ? null : c.id)}
          style={[styles.row, i > 0 && styles.border, { alignItems: "flex-start" }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.mono, c.error ? { color: colors.flare } : null]}>
              {c.purpose} <Text style={{ color: colors.court500 }}>{c.promptVersion}</Text>
            </Text>
            <Muted style={{ fontSize: 12 }}>
              {when(c.createdAt)} · {c.username ?? "—"} · {c.model}
            </Muted>
            <Muted style={{ fontSize: 12 }}>
              {c.inputTokens ?? "—"}/{c.outputTokens ?? "—"} tok ·{" "}
              <Text style={{ color: c.latencyMs > 10_000 ? tierColor(65) : colors.court300 }}>
                {c.latencyMs.toLocaleString()} ms
              </Text>
            </Muted>
            {open === c.id && c.error && (
              <Text selectable style={{ color: colors.flare, fontSize: 12 }}>
                {c.error}
              </Text>
            )}
          </View>
          <Text style={styles.value}>{c.costUsd !== null ? usd(c.costUsd) : "—"}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

/** Reports from dev and admin accounts (DESIGN.md §8.9); tap one to resolve or reopen it. */
function BugReports() {
  const [showResolved, setShowResolved] = useState(false);
  const reports = useBugReports(showResolved ? undefined : "open");
  const setStatus = useSetBugReportStatus();
  return (
    <View style={{ gap: space.sm }}>
      <Segmented
        label="Filter"
        value={showResolved ? "all" : "open"}
        onChange={(v) => setShowResolved(v === "all")}
        options={[
          { value: "open", label: "Open" },
          { value: "all", label: "All" },
        ]}
      />
      <ErrorNote error={reports.error ?? setStatus.error} />
      {reports.isPending && <Loading />}
      {reports.data && (
        <Card style={{ padding: 0 }}>
          {reports.data.length === 0 && (
            <Muted style={{ padding: space.lg }}>
              {showResolved ? "No bug reports yet." : "Nothing open. Nice."}
            </Muted>
          )}
          {reports.data.map((r, i) => (
            <Pressable
              key={r.id}
              accessibilityHint={r.status === "open" ? "Marks it resolved" : "Reopens it"}
              disabled={setStatus.isPending}
              onPress={() =>
                setStatus.mutate({ id: r.id, status: r.status === "open" ? "resolved" : "open" })
              }
              style={[
                styles.row,
                i > 0 && styles.border,
                { alignItems: "flex-start" },
                r.status === "resolved" && { opacity: 0.55 },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable style={{ color: colors.court100, fontSize: 15 }}>
                  {r.message}
                </Text>
                <Muted style={{ fontSize: 12 }}>
                  @{r.username} · {r.platform}
                  {r.page ? ` · ${r.page}` : ""} · {when(r.createdAt)}
                </Muted>
                {r.device ? (
                  <Muted numberOfLines={1} style={{ fontSize: 12 }}>
                    {r.device}
                  </Muted>
                ) : null}
              </View>
              <Text
                style={[
                  styles.mono,
                  { color: r.status === "open" ? colors.neon : colors.court500 },
                ]}
              >
                {r.status === "open" ? "Resolve" : "Reopen"}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  );
}

/** What each sign-in fix did, for the confirmation. */
const ACTION_DONE: Record<AccountAction, string> = {
  "verify-email": "Email marked confirmed. They can sign in now.",
  "resend-verification": "Confirmation email sent.",
  "send-password-reset": "Password reset email sent (the link lasts an hour).",
  "sign-out-everywhere": "Signed out on every device.",
};

/** A search that waits for a pause in typing. */
function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Accounts (web Front Office, DESIGN.md §8.7): search and filter, sign a player, change the
 * type or season mode, fix sign-in and release (delete) an account.
 */
function Users({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [signing, setSigning] = useState(false);
  const search = useDebounced(q.trim());
  const users = useAdminUsers({ q: search || undefined, role: roleFilter || undefined });
  const setRole = useSetRole();
  const setMode = useSetSeasonMode();
  const action = useAccountAction();
  const remove = useDeleteAccount();
  if (users.isPending) return <Loading />;

  /** Sign-in fixes and release for one account, from a sheet. */
  const manage = (u: AdminUserDto) => {
    const fixes: { label: string; action: AccountAction }[] =
      u.emailVerified === null
        ? []
        : [
            ...(u.emailVerified === false
              ? [
                  { label: "Confirm email", action: "verify-email" as const },
                  { label: "Resend confirmation", action: "resend-verification" as const },
                ]
              : []),
            ...(u.signIn.length > 0
              ? [
                  {
                    label: u.signIn.includes("credential")
                      ? "Send password reset"
                      : "Email a set-password link",
                    action: "send-password-reset" as const,
                  },
                ]
              : []),
            { label: "Sign out everywhere", action: "sign-out-everywhere" as const },
          ];
    const canDelete = u.id !== myId;
    const options = [
      ...fixes.map((f) => f.label),
      ...(canDelete ? ["Delete account…"] : []),
      "Cancel",
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `@${u.username}`,
        message:
          u.emailVerified === null ? "A dev-mode player with no sign-in to manage." : undefined,
        options,
        cancelButtonIndex: options.length - 1,
        ...(canDelete && { destructiveButtonIndex: fixes.length }),
        userInterfaceStyle: "dark",
      },
      (idx) => {
        const fix = fixes[idx];
        if (fix) {
          action.mutate(
            { id: u.id, action: fix.action },
            { onSuccess: () => Alert.alert("Done", ACTION_DONE[fix.action]) },
          );
        } else if (canDelete && idx === fixes.length) {
          Alert.prompt(
            `Delete @${u.username}?`,
            `Deletes the account, its sign-in and every season, habit, log and rating. This can't be undone. Type ${u.username} to confirm.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: (typed?: string) => {
                  if ((typed ?? "").trim().toLowerCase() !== u.username) {
                    Alert.alert("Not deleted", "The username didn't match.");
                    return;
                  }
                  remove.mutate({ id: u.id, confirm: typed ?? "" });
                },
              },
            ],
            "plain-text",
            "",
            "default",
          );
        }
      },
    );
  };

  /** Picks another mode for the account's running season, then confirms (goals are cleared). */
  const pickMode = (u: AdminUserDto) => {
    const modes = SEASON_MODES.filter((m) => m !== u.seasonMode && seasonModeAllowed(u.role, m));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Season mode for @${u.username}`,
        message: "Players can only change it during setup. Switching clears the season's goals.",
        options: [...modes.map((m) => SEASON_MODE_LABELS[m]), "Cancel"],
        cancelButtonIndex: modes.length,
        userInterfaceStyle: "dark",
      },
      (idx) => {
        const mode = modes[idx];
        if (!mode) return;
        Alert.alert(
          `Switch to ${SEASON_MODE_LABELS[mode]}?`,
          `@${u.username}'s goals this season are cleared, and they move to that mode's leaderboard.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Switch", onPress: () => setMode.mutate({ id: u.id, mode }) },
          ],
        );
      },
    );
  };
  return (
    <View style={{ gap: space.sm }}>
      <Field
        value={q}
        onChangeText={setQ}
        placeholder="Search name, username or email"
        accessibilityLabel="Search accounts"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        <Chip label="All" selected={roleFilter === ""} onPress={() => setRoleFilter("")} />
        {USER_ROLES.map((r) => (
          <Chip
            key={r}
            label={ROLE_LABELS[r]}
            selected={roleFilter === r}
            onPress={() => setRoleFilter(r)}
          />
        ))}
      </View>
      {signing ? (
        <SignPlayer onDone={() => setSigning(false)} />
      ) : (
        <Button title="Sign a player" variant="ghost" onPress={() => setSigning(true)} />
      )}
      <Label>Users {users.data ? `(${users.data.length})` : ""}</Label>
      <ErrorNote
        error={users.error ?? setRole.error ?? setMode.error ?? action.error ?? remove.error}
      />
      <Card style={{ padding: 0 }}>
        {users.data?.length === 0 && (
          <Muted style={{ padding: space.md }}>No accounts match.</Muted>
        )}
        {users.data?.map((u, i) => (
          <View key={u.id} style={[styles.row, i > 0 && styles.border]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.court100, fontSize: 16 }}>{u.displayName}</Text>
              <SignInChips user={u} />
              <Muted style={{ fontSize: 12 }}>
                @{u.username} · {u.email} · {u.timezone}
              </Muted>
              <Muted style={{ fontSize: 12 }}>
                Joined {new Date(u.createdAt).toLocaleDateString()} · last logged{" "}
                {u.lastLogged ?? "—"} · {u.llmCalls} calls · {usd(u.costUsd)}
              </Muted>
            </View>
            <View style={{ alignItems: "flex-end", gap: space.xs }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Account type for ${u.username}`}
                disabled={u.id === myId || setRole.isPending}
                onPress={() =>
                  ActionSheetIOS.showActionSheetWithOptions(
                    {
                      title: `Account type for @${u.username}`,
                      options: [...USER_ROLES.map((r) => ROLE_LABELS[r]), "Cancel"],
                      cancelButtonIndex: USER_ROLES.length,
                      userInterfaceStyle: "dark",
                    },
                    (idx) => {
                      const role = USER_ROLES[idx];
                      if (role && role !== u.role) setRole.mutate({ id: u.id, role });
                    },
                  )
                }
                style={[
                  styles.role,
                  u.role !== "user" && { borderColor: roleColor(u.role) },
                  u.id === myId && { opacity: 0.5 },
                ]}
              >
                <Text
                  style={{
                    color: u.role !== "user" ? roleColor(u.role) : colors.court300,
                    fontSize: 12,
                  }}
                >
                  {ROLE_LABELS[u.role]}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Season mode for ${u.username}`}
                disabled={!u.seasonMode || setMode.isPending}
                onPress={() => pickMode(u)}
                style={[styles.role, !u.seasonMode && { opacity: 0.5 }]}
              >
                <Text style={{ color: colors.court300, fontSize: 12 }}>
                  {u.seasonMode ? SEASON_MODE_LABELS[u.seasonMode] : "No season"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Manage ${u.username}`}
                disabled={action.isPending || remove.isPending}
                onPress={() => manage(u)}
                style={styles.role}
              >
                <Text style={{ color: colors.neon, fontSize: 12 }}>Manage</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

/** "No sign-in" (dev-mode players), "Unconfirmed" email, or a Google sign-in. */
function SignInChips({ user: u }: { user: AdminUserDto }) {
  const chips = [
    ...(u.emailVerified === null ? [{ label: "No sign-in", color: colors.court500 }] : []),
    ...(u.emailVerified === false ? [{ label: "Unconfirmed", color: tierColor(65) }] : []),
    ...(u.signIn.includes("google") ? [{ label: "Google", color: colors.court300 }] : []),
  ];
  if (!chips.length) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {chips.map((c) => (
        <Text key={c.label} style={[styles.chip, { color: c.color, borderColor: c.color }]}>
          {c.label}
        </Text>
      ))}
    </View>
  );
}

/**
 * Creates an email + password account by hand. The admin sets the password to pass on (the
 * player can change it in Settings).
 */
function SignPlayer({ onDone }: { onDone: () => void }) {
  const create = useCreateAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [verified, setVerified] = useState(true);
  const [created, setCreated] = useState<{ user: AdminUserDto; verified: boolean } | null>(null);

  const submit = () =>
    create.mutate(
      { name, email, password, role, verified },
      {
        onSuccess: (user) => {
          setCreated({ user, verified });
          setName("");
          setEmail("");
          setPassword("");
        },
      },
    );

  return (
    <Card style={{ gap: space.sm }}>
      <Label>Sign a player</Label>
      <Field value={name} onChangeText={setName} placeholder="Name" maxLength={60} />
      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder={`Password (at least ${ADMIN_MIN_PASSWORD} characters)`}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <Muted style={{ fontSize: 12 }}>
        Shown so you can pass it on. They can change it in Settings.
      </Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        {USER_ROLES.map((r) => (
          <Chip key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </View>
      <Muted style={{ fontSize: 12 }}>{ROLE_DETAILS[role]}</Muted>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Switch value={verified} onValueChange={setVerified} />
        <Muted style={{ flex: 1, fontSize: 13 }}>
          Email already confirmed (no confirmation email; they can sign in straight away)
        </Muted>
      </View>
      <ErrorNote error={create.error} />
      {created && (
        <Text style={{ color: colors.neon }}>
          Signed @{created.user.username} ({ROLE_LABELS[created.user.role]}).{" "}
          {created.verified
            ? "They can sign in now."
            : `A confirmation email went to ${created.user.email}.`}
        </Text>
      )}
      <Button
        title={create.isPending ? "Creating…" : "Create account"}
        disabled={
          create.isPending || !name.trim() || !email.trim() || password.length < ADMIN_MIN_PASSWORD
        }
        onPress={submit}
      />
      <Button title="Done" variant="ghost" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.court500 },
  bars: { height: 110, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: {
    flex: 1,
    backgroundColor: colors.neon,
    opacity: 0.75,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  chip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    overflow: "hidden",
  },
  mono: { color: colors.court100, fontFamily: "Menlo", fontSize: 12 },
  value: { color: colors.court100, fontSize: 14, fontVariant: ["tabular-nums"] },
  role: {
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
});
