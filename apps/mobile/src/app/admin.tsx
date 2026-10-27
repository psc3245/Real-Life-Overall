import { USER_ROLES, type LlmCallDto, type UsageRowDto } from "@rlo/shared";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import { useAdminOverview, useAdminUsers, useIsAdmin, useLlmCalls, useSetRole } from "@/api/admin";
import { useMe } from "@/api/hooks";
import { Segmented } from "@/components/controls";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Card, ErrorNote, Label, Loading, Muted, Screen } from "@/components/ui";
import { colors, space, tierColor } from "@/lib/theme";

const usd = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type Tab = "usage" | "calls" | "users";

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
        ]}
      />
      {tab === "usage" && <Usage />}
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

function Users({ myId }: { myId: string }) {
  const users = useAdminUsers();
  const setRole = useSetRole();
  if (users.isPending) return <Loading />;
  return (
    <View style={{ gap: space.sm }}>
      <Label>Users {users.data ? `(${users.data.length})` : ""}</Label>
      <ErrorNote error={users.error ?? setRole.error} />
      <Card style={{ padding: 0 }}>
        {users.data?.map((u, i) => (
          <View key={u.id} style={[styles.row, i > 0 && styles.border]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.court100, fontSize: 16 }}>{u.displayName}</Text>
              <Muted style={{ fontSize: 12 }}>
                @{u.username} · {u.email} · {u.timezone}
              </Muted>
              <Muted style={{ fontSize: 12 }}>
                Joined {new Date(u.createdAt).toLocaleDateString()} · last logged{" "}
                {u.lastLogged ?? "—"} · {u.llmCalls} calls · {usd(u.costUsd)}
              </Muted>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Role for ${u.username}`}
              disabled={u.id === myId || setRole.isPending}
              onPress={() =>
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    title: `Role for @${u.username}`,
                    options: [...USER_ROLES, "Cancel"],
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
                u.role === "admin" && { borderColor: tierColor(65) },
                u.id === myId && { opacity: 0.5 },
              ]}
            >
              <Text
                style={{
                  color: u.role === "admin" ? tierColor(65) : colors.court300,
                  fontSize: 12,
                }}
              >
                {u.role}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
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
