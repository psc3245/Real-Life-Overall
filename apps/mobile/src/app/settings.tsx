import {
  LEADERBOARD_MIN_RECAPPED_DAYS,
  PROFILE_VISIBILITIES,
  USERNAME_PATTERN,
  type ProfileVisibility,
} from "@rlo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import { authClient } from "@/api/auth";
import { getDevUser, setDevUser } from "@/api/client";
import { useMe, type Me } from "@/api/hooks";
import { useAuthState, useSignOut } from "@/api/session";
import { useUpdateProfile } from "@/api/social";
import { TrackingSettings } from "@/components/body/TrackingSettings";
import { FormRow } from "@/components/controls";
import { SettingRow, SettingsGroup } from "@/components/settings";
import { ShareLink, VISIBILITY_LABEL } from "@/components/social";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Field,
  Label,
  Loading,
  Muted,
  Screen,
} from "@/components/ui";
import { API_URL, WEB_URL } from "@/lib/config";
import { colors, fonts, space } from "@/lib/theme";

const MIN_PASSWORD = 8;
const RESET_REDIRECT = `${WEB_URL}/reset-password`;

const VISIBILITY_DETAIL: Record<ProfileVisibility, string> = {
  private: "Nobody else can open your profile.",
  friends: "Players you've accepted as friends can see your card.",
  public: "Anyone with your link can see your card, signed in or not.",
};

/** Account, sign-in & security, sharing, units & body (the web's /settings). */
export default function SettingsScreen() {
  const me = useMe();
  const auth = useAuthState();
  const signOut = useSignOut();
  if (me.isPending) return <Loading title="Settings" />;
  if (me.isError) {
    return (
      <Screen title="Settings">
        <ErrorNote error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen title="Settings" onRefresh={() => me.refetch()}>
      <ProfileForm me={me.data} />
      {auth.mode === "better-auth" && <SignInSettings />}
      <SharingSection me={me.data} />
      <TrackingSettings me={me.data} />
      {auth.mode === "dev" && <DevUser />}
      <View style={{ gap: space.sm }}>
        <Label>About</Label>
        <Card style={{ gap: space.xs }}>
          <Muted style={{ fontSize: 13 }}>Server: {API_URL}</Muted>
          <Muted style={{ fontSize: 13 }}>
            Auth: {auth.mode === "dev" ? "dev (x-dev-user)" : "Better Auth"}
          </Muted>
        </Card>
        {auth.mode === "better-auth" && (
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        )}
      </View>
    </Screen>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const normalized = username.trim().toLowerCase();
  const validUsername = USERNAME_PATTERN.test(normalized);
  const dirty = displayName.trim() !== me.displayName || normalized !== me.username;

  const save = () =>
    update.mutate({
      ...(displayName.trim() !== me.displayName && { displayName: displayName.trim() }),
      ...(normalized !== me.username && { username: normalized }),
    });

  return (
    <View style={{ gap: space.sm }}>
      <Label>Profile</Label>
      <Card style={{ gap: space.md }}>
        <FormRow label="Display name">
          <Field value={displayName} maxLength={40} onChangeText={setDisplayName} />
        </FormRow>
        <FormRow label="Username">
          <Field
            value={username}
            maxLength={24}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
          />
          <Muted style={{ fontSize: 12, color: validUsername ? colors.court500 : colors.flare }}>
            Your profile link is /u/{normalized || "…"}. 3-24 lowercase letters, digits, - or _.
          </Muted>
        </FormRow>
        <Button
          title={update.isPending ? "Saving…" : update.isSuccess && !dirty ? "Saved" : "Save"}
          disabled={!dirty || !validUsername || !displayName.trim() || update.isPending}
          onPress={save}
        />
        <ErrorNote error={update.error} />
      </Card>
    </View>
  );
}

function SharingSection({ me }: { me: Me }) {
  const update = useUpdateProfile();
  const canOptIn = me.profileVisibility === "public" || me.leaderboardOptIn;
  return (
    <View style={{ gap: space.sm }}>
      <Label>Sharing</Label>
      <Muted>
        Shared cards show your Overall, archetype, category ratings and catalog badges. Journals,
        recaps, attributes and the model&apos;s reasoning are never shared.
      </Muted>
      {PROFILE_VISIBILITIES.map((v) => {
        const on = me.profileVisibility === v;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            disabled={update.isPending}
            onPress={() => update.mutate({ profileVisibility: v })}
          >
            <Card style={[styles.option, on && styles.optionOn]}>
              <SymbolView
                name={on ? "largecircle.fill.circle" : "circle"}
                tintColor={on ? colors.neon : colors.court500}
                size={20}
              />
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "600" }}>{VISIBILITY_LABEL[v]}</Body>
                <Muted style={{ fontSize: 13, color: colors.court500 }}>
                  {VISIBILITY_DETAIL[v]}
                </Muted>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Card style={[styles.option, !canOptIn && { opacity: 0.6 }]}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: "600" }}>Show me on global leaderboards</Body>
          <Muted style={{ fontSize: 13, color: colors.court500 }}>
            {me.profileVisibility === "public"
              ? `Ratings count once at least ${LEADERBOARD_MIN_RECAPPED_DAYS} days this season are recapped. Friends boards don't need this.`
              : "Global boards only include public profiles."}
          </Muted>
        </View>
        <Switch
          value={me.leaderboardOptIn}
          // Turning it off always works; opting in needs a public profile.
          disabled={update.isPending || !canOptIn}
          onValueChange={(leaderboardOptIn) => update.mutate({ leaderboardOptIn })}
          trackColor={{ true: colors.neonDim }}
          thumbColor={colors.court100}
        />
      </Card>
      <ErrorNote error={update.error} />
      {me.profileVisibility !== "private" && <ShareLink username={me.username} />}
    </View>
  );
}

/** Email, password and signed-in devices. Only for real sign-in (not AUTH_MODE=dev). */
function SignInSettings() {
  const session = authClient.useSession();
  const email = session.data?.user.email;
  // Google-only players have no password yet; they can set one by email.
  const accounts = useQuery({
    queryKey: ["auth-accounts"],
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(result.error.message ?? "Couldn't load sign-in methods");
      return result.data;
    },
  });
  const hasPassword = accounts.data?.some((a) => a.providerId === "credential");
  const hasGoogle = accounts.data?.some((a) => a.providerId === "google");
  return (
    <SettingsGroup title="Sign-in & security">
      <SettingRow
        label={email ?? "Email"}
        detail={
          hasGoogle
            ? hasPassword
              ? "Sign in with Google or your password."
              : "You sign in with Google."
            : "You sign in with your email and password."
        }
      />
      {accounts.isSuccess &&
        (hasPassword ? <ChangePassword /> : email && <SetPasswordByEmail email={email} />)}
      <SignOutOthers />
    </SettingsGroup>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };
  const submit = async () => {
    if (next !== confirm) return;
    setBusy(true);
    setError(null);
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (result.error) {
      setError(
        new Error(
          result.error.code === "INVALID_PASSWORD"
            ? "That current password isn't right."
            : (result.error.message ?? "Couldn't change your password"),
        ),
      );
      return;
    }
    reset();
    setOpen(false);
    setDone(true);
  };

  if (!open) {
    return (
      <SettingRow
        label="Password"
        detail={done ? "Password changed. Your other devices were signed out." : undefined}
      >
        <Pressable
          onPress={() => {
            setDone(false);
            setOpen(true);
          }}
          hitSlop={6}
        >
          <Body style={{ color: colors.neon }}>Change</Body>
        </Pressable>
      </SettingRow>
    );
  }
  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type: "password" | "newPassword",
  ) => (
    <FormRow label={label}>
      <Field
        value={value}
        onChangeText={onChange}
        secureTextEntry
        textContentType={type}
        autoCapitalize="none"
      />
    </FormRow>
  );
  return (
    <SettingRow label="Change password" stacked>
      {field("Current password", current, setCurrent, "password")}
      {field("New password", next, setNext, "newPassword")}
      <Muted style={{ fontSize: 12 }}>At least {MIN_PASSWORD} characters.</Muted>
      {field("Confirm new password", confirm, setConfirm, "newPassword")}
      {mismatch && (
        <Muted style={{ fontSize: 12, color: colors.flare }}>
          Doesn&apos;t match the new password.
        </Muted>
      )}
      <Muted style={{ fontSize: 12 }}>Changing it signs you out on your other devices.</Muted>
      <ErrorNote error={error} />
      <Button
        title={busy ? "Saving…" : "Update password"}
        disabled={busy || !current || next.length < MIN_PASSWORD || next !== confirm}
        onPress={() => void submit()}
      />
      <Button
        title="Cancel"
        variant="ghost"
        onPress={() => {
          reset();
          setOpen(false);
        }}
      />
    </SettingRow>
  );
}

/** Google-only players add a password through the reset email. */
function SetPasswordByEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setState("sending");
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: RESET_REDIRECT });
    if (result.error) {
      setError(result.error.message ?? "Couldn't send the email");
      setState("idle");
    } else setState("sent");
  };
  return (
    <SettingRow
      label="Password"
      detail={
        state === "sent"
          ? `Check ${email} for a link to set your password.`
          : (error ?? "Add one to sign in without Google. We'll email you a link.")
      }
    >
      <Pressable disabled={state !== "idle"} onPress={() => void send()} hitSlop={6}>
        <Body style={{ color: colors.neon, opacity: state === "idle" ? 1 : 0.5 }}>
          {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Set one"}
        </Body>
      </Pressable>
    </SettingRow>
  );
}

function SignOutOthers() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setState("busy");
    setError(null);
    const result = await authClient.revokeOtherSessions();
    if (result.error) {
      setError(result.error.message ?? "Couldn't sign out other devices");
      setState("idle");
    } else setState("done");
  };
  return (
    <SettingRow
      label="Other devices"
      detail={
        error ??
        (state === "done"
          ? "Signed out everywhere else."
          : "Signed in somewhere you shouldn't be? Sign out everywhere but here.")
      }
      last
    >
      <Pressable
        disabled={state !== "idle"}
        hitSlop={6}
        onPress={() =>
          Alert.alert("Sign out your other devices?", "This phone stays signed in.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out others", style: "destructive", onPress: () => void run() },
          ])
        }
      >
        <Body style={{ color: colors.flare, opacity: state === "idle" ? 1 : 0.5 }}>
          {state === "busy" ? "…" : "Sign out"}
        </Body>
      </Pressable>
    </SettingRow>
  );
}

/** AUTH_MODE=dev only: switch which dev player the API sees (e.g. "demo"). */
function DevUser() {
  const queryClient = useQueryClient();
  const [name, setName] = useState(getDevUser());
  const apply = () => {
    const next = name.trim().toLowerCase() || "dev";
    setDevUser(next);
    setName(next);
    void queryClient.invalidateQueries();
  };
  return (
    <View style={{ gap: space.sm }}>
      <Label>Dev user</Label>
      <Card style={{ gap: space.sm }}>
        <Field
          value={name}
          onChangeText={setName}
          onSubmitEditing={apply}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="Switch" variant="ghost" onPress={apply} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  navBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.court800 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.flare,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.court100, fontFamily: fonts.display, fontSize: 13 },
  option: { flexDirection: "row", alignItems: "center", gap: space.md },
  optionOn: { borderColor: colors.neon, backgroundColor: "rgba(60,242,200,0.05)" },
});
