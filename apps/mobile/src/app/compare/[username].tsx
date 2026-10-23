import { alignCategories, type ComparisonRow, type ProfileDto } from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useMe } from "@/api/hooks";
import { useProfile } from "@/api/social";
import { OvrBadge } from "@/components/ratings";
import { Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { colors, fonts, space, tierColor } from "@/lib/theme";

/** Side-by-side cards: you on the left, them on the right. */
export default function CompareScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const me = useMe();
  const mine = useProfile(me.data?.username ?? "", Boolean(me.data));
  const theirs = useProfile(username);

  const error = me.error ?? mine.error ?? theirs.error;
  if (theirs.error instanceof ApiError && theirs.error.status === 404) {
    return (
      <Screen>
        <Card>
          <Muted>This player hasn&apos;t shared their card with you.</Muted>
        </Card>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorNote error={error} />
      </Screen>
    );
  }
  if (!mine.data || !theirs.data) return <Loading />;
  if (!mine.data.card || !theirs.data.card) {
    return (
      <Screen>
        <Muted>
          {mine.data.card ? `${theirs.data.displayName} has` : "You have"} no rating to compare yet.
        </Muted>
      </Screen>
    );
  }

  const rows = alignCategories(mine.data.card.categories, theirs.data.card.categories);
  return (
    <Screen eyebrow="Compare" title="Head to head">
      <View style={styles.sides}>
        <Side profile={mine.data} align="left" />
        <Text style={styles.vs}>VS</Text>
        <Side profile={theirs.data} align="right" />
      </View>
      <View style={{ gap: space.lg }}>
        {rows.map((row) => (
          <Row key={row.name} row={row} />
        ))}
      </View>
      <Muted style={{ textAlign: "center", fontSize: 12, color: colors.court500 }}>
        Template categories line up even when renamed; custom ones match by name.
      </Muted>
    </Screen>
  );
}

function Side({ profile, align }: { profile: ProfileDto; align: "left" | "right" }) {
  const card = profile.card!;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/u/[username]", params: { username: profile.username } })
      }
      style={[styles.side, { alignItems: align === "left" ? "flex-start" : "flex-end" }]}
    >
      <OvrBadge value={card.overall} size={56} />
      <Text style={[styles.name, { textAlign: align }]} numberOfLines={1}>
        {profile.displayName}
      </Text>
      <Text style={[styles.archetype, { textAlign: align }]} numberOfLines={1}>
        {card.archetype ?? "Unranked"}
      </Text>
    </Pressable>
  );
}

function Row({ row }: { row: ComparisonRow }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.rowName}>{row.name}</Text>
      <View style={styles.rowBars}>
        <Value value={row.mine} />
        <Bar value={row.mine} side="left" label={`You: ${row.name}`} />
        <Bar value={row.theirs} side="right" label={`Them: ${row.name}`} />
        <Value value={row.theirs} align="right" />
      </View>
    </View>
  );
}

function Value({ value, align = "left" }: { value: number | null; align?: "left" | "right" }) {
  return (
    <Text
      style={[
        styles.value,
        { textAlign: align, color: value == null ? colors.court700 : tierColor(value) },
      ]}
    >
      {value == null ? "—" : value.toFixed(1)}
    </Text>
  );
}

function Bar({
  value,
  side,
  label,
}: {
  value: number | null;
  side: "left" | "right";
  label: string;
}) {
  return (
    <View
      style={[styles.track, { alignItems: side === "left" ? "flex-end" : "flex-start" }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value ?? 0 }}
    >
      {value != null && (
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: tierColor(value) }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { flexDirection: "row", alignItems: "center", gap: space.md },
  side: { flex: 1, gap: space.xs },
  vs: { color: colors.court500, fontFamily: fonts.display, fontSize: 20 },
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 17,
    textTransform: "uppercase",
    alignSelf: "stretch",
  },
  archetype: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    alignSelf: "stretch",
  },
  rowName: {
    color: colors.court300,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  rowBars: { flexDirection: "row", alignItems: "center", gap: space.sm },
  value: { width: 48, fontFamily: fonts.heavy, fontSize: 18 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.court700 },
  fill: { height: "100%", borderRadius: 4 },
});
