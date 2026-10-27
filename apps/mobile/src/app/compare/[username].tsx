import {
  alignCategories,
  type ComparisonRow,
  type ProfileDto,
  type PublicCardDto,
  type SeasonMode,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useMe } from "@/api/hooks";
import { useProfile } from "@/api/social";
import { OvrBadge } from "@/components/ratings";
import { Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { formatScore, scoreColor, ScoreProvider, useScore } from "@/components/score";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/** A card's numbers for the comparison's mode: growth is on every card, ratings only on some. */
const scoresIn = (card: PublicCardDto, mode: SeasonMode) =>
  mode === "growth" ? card.growth : { overall: card.overall, categories: card.categories };

/** Side-by-side cards: you on the left, them on the right. */
function CompareScreen() {
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

  // Ratings compare only when both play for rating; otherwise both sides show growth.
  const mode: SeasonMode =
    mine.data.card.mode === "rating" && theirs.data.card.mode === "rating" ? "rating" : "growth";
  const left = scoresIn(mine.data.card, mode);
  const right = scoresIn(theirs.data.card, mode);
  const rows = alignCategories(left.categories, right.categories);
  return (
    <ScoreProvider mode={mode} values={rows.flatMap((r) => [r.mine, r.theirs])}>
      <Screen eyebrow="Compare" title="Head to head">
        <View style={styles.sides}>
          <Side profile={mine.data} overall={left.overall} align="left" />
          <Text style={styles.vs}>VS</Text>
          <Side profile={theirs.data} overall={right.overall} align="right" />
        </View>
        <View style={{ gap: space.lg }}>
          {rows.map((row) => (
            <Row key={row.name} row={row} />
          ))}
        </View>
        <Muted style={{ textAlign: "center", fontSize: 12, color: colors.court500 }}>
          Template categories line up even when renamed; custom ones match by name.
          {mode === "growth" && " Compared on points gained this season."}
        </Muted>
      </Screen>
    </ScoreProvider>
  );
}

function Side({
  profile,
  overall,
  align,
}: {
  profile: ProfileDto;
  overall: number;
  align: "left" | "right";
}) {
  const talk = useTalk();
  const card = profile.card!;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/u/[username]", params: { username: profile.username } })
      }
      style={[styles.side, { alignItems: align === "left" ? "flex-start" : "flex-end" }]}
    >
      <OvrBadge value={overall} size={56} />
      <Text style={[styles.name, { textAlign: align }]} numberOfLines={1}>
        {profile.displayName}
      </Text>
      <Text style={[styles.archetype, { textAlign: align }]} numberOfLines={1}>
        {card.archetype ?? talk.unranked}
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
  const { mode } = useScore();
  return (
    <Text
      style={[
        styles.value,
        { textAlign: align, color: value == null ? colors.court700 : scoreColor(mode, value) },
      ]}
    >
      {value == null ? "—" : formatScore(mode, value)}
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
  const { mode, max } = useScore();
  return (
    <View
      style={[styles.track, { alignItems: side === "left" ? "flex-end" : "flex-start" }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value ?? 0 }}
    >
      {value != null && (
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, (value / max) * 100)}%`,
              backgroundColor: scoreColor(mode, value),
            },
          ]}
        />
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

export default function GatedCompareScreen() {
  return (
    <FeatureGate feature="friends">
      <CompareScreen />
    </FeatureGate>
  );
}
