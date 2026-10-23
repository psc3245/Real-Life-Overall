import {
  LEADERBOARD_MIN_RECAPPED_DAYS,
  PROFILE_VISIBILITIES,
  USERNAME_PATTERN,
  type ProfileVisibility,
} from "@rlo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { getDevUser, setDevUser } from "@/api/client";
import { useMe, type Me } from "@/api/hooks";
import { useFriends, useUpdateProfile } from "@/api/social";
import { useAuthState, useSignOut } from "@/api/session";
import { FormRow } from "@/components/controls";
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
import { API_URL } from "@/lib/config";
import { colors, fonts, space } from "@/lib/theme";

const VISIBILITY_DETAIL: Record<ProfileVisibility, string> = {
  private: "Nobody else can open your profile.",
  friends: "Players you've accepted as friends can see your card.",
  public: "Anyone with your link can see your card, signed in or not.",
};

/** Your player: social, history, profile and sharing settings, and the account. */
export default function MeScreen() {
  const auth = useAuthState();
  const me = useMe();
  const friends = useFriends();
  const signOut = useSignOut();

  if (me.isPending) return <Loading title="You" />;
  if (me.isError) {
    return (
      <Screen title="You" onRefresh={() => me.refetch()}>
        <ErrorNote error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  const requests = friends.data?.incoming.length ?? 0;

  return (
    <Screen
      eyebrow={`@${me.data.username}`}
      title={me.data.displayName}
      onRefresh={() => Promise.all([me.refetch(), friends.refetch()])}
    >
      <Card style={{ padding: 0 }}>
        <NavRow
          icon="person.text.rectangle"
          label="Your profile"
          href={{ pathname: "/u/[username]", params: { username: me.data.username } }}
        />
        <NavRow icon="person.2" label="Friends" href="/friends" badge={requests} />
        <NavRow icon="trophy" label="Leaderboards" href="/leaderboards" />
        <NavRow icon="clock.arrow.circlepath" label="Season history" href="/history" />
        <NavRow icon="list.bullet.rectangle" label="Rating activity" href="/activity" />
        <NavRow icon="slider.horizontal.3" label="Manage habits" href="/habits/manage" last />
      </Card>

      <ProfileForm me={me.data} />
      <SharingSection me={me.data} />
      {auth.mode === "dev" && <DevUser />}

      <View style={{ gap: space.sm }}>
        <Label>Account</Label>
        <Card style={{ gap: space.xs }}>
          {auth.mode === "better-auth" && auth.user && <Body>{auth.user.email}</Body>}
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

function NavRow({
  icon,
  label,
  href,
  badge = 0,
  last,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  href: Href;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.nav, !last && styles.navBorder, pressed && { opacity: 0.6 }]}
    >
      <SymbolView name={icon} tintColor={colors.neon} size={20} />
      <Body style={{ flex: 1 }}>{label}</Body>
      {badge > 0 && (
        <View style={styles.badge} accessibilityLabel={`${badge} pending`}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <SymbolView name="chevron.right" tintColor={colors.court500} size={14} />
    </Pressable>
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
