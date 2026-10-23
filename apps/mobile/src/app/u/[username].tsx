import { BADGE_TIER_LABELS } from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useProfile } from "@/api/social";
import { Medallion } from "@/components/badges";
import { PublicCard } from "@/components/PlayerCard";
import { FriendButtons, ShareLink, VISIBILITY_LABEL } from "@/components/social";
import { Card, ErrorNote, Label, Loading, Muted, Screen, TextLink } from "@/components/ui";
import { instantMonthYear } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";

/** A player's shared card. */
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useProfile(username);

  if (profile.isPending) return <Loading />;
  if (profile.isError) {
    return (
      <Screen>
        {profile.error instanceof ApiError && profile.error.status === 404 ? (
          <Card style={{ gap: space.sm }}>
            <Text style={styles.name}>Profile not available</Text>
            <Muted>This player doesn&apos;t exist or hasn&apos;t shared their card with you.</Muted>
          </Card>
        ) : (
          <ErrorNote error={profile.error} onRetry={() => void profile.refetch()} />
        )}
      </Screen>
    );
  }

  const p = profile.data;
  return (
    <Screen eyebrow={`@${p.username}`} title={p.displayName} onRefresh={() => profile.refetch()}>
      <Muted>Joined {instantMonthYear(p.memberSince)}</Muted>
      {p.isSelf && (
        <Card style={{ gap: space.sm }}>
          <Muted>
            This is how other players see your card. Visibility:{" "}
            <Text style={{ color: colors.court100 }}>
              {VISIBILITY_LABEL[p.visibility ?? "private"]}
            </Text>
          </Muted>
          {p.visibility !== "private" && <ShareLink username={p.username} />}
          <TextLink href="/me">Sharing settings →</TextLink>
        </Card>
      )}
      {p.card ? (
        <PublicCard card={p.card} name={p.displayName} />
      ) : (
        <Card>
          <Muted>No rating yet.</Muted>
        </Card>
      )}
      {p.friendship && (
        <FriendButtons username={p.username} state={p.friendship} canCompare={Boolean(p.card)} />
      )}
      <View style={{ gap: space.sm }}>
        <Label>Badges</Label>
        {p.badges.length ? (
          <View style={styles.badges}>
            {p.badges.map((b) => (
              <View key={b.key} style={styles.badge}>
                <Medallion tier={b.tier} size={26} />
                <Text style={{ color: colors.court100, fontSize: 14 }}>
                  {b.name}
                  <Text style={{ color: colors.court500 }}> · {BADGE_TIER_LABELS[b.tier]}</Text>
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Muted>None yet.</Muted>
        )}
      </View>
      {!p.isSelf && !p.friendship && (
        <Muted onPress={() => router.back()}>Sign in to add {p.displayName} as a friend.</Muted>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 20,
    textTransform: "uppercase",
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.court800,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
