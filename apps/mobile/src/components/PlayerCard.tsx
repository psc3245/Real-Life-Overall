import { LEADERBOARD_MIN_RECAPPED_DAYS, type PublicCardDto, type RatingsDto } from "@rlo/shared";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";
import { useTalk } from "@/lib/talk";
import { OvrBadge, StatBar } from "./ratings";
import { formatScore, ScoreProvider, useScore } from "./score";

interface CardCategory {
  key: string;
  /** Makes the bar a link (your own card's categories open their pages). */
  nodeId?: string;
  name: string;
  value: number;
  trend?: number | null;
  projection?: number | null;
  goal?: number | null;
}

/** The card layout shared by your own card and other players' public cards. */
export function CardView({
  name,
  overall,
  subtitle,
  note,
  categories,
}: {
  name: string;
  overall: number;
  subtitle: string;
  note?: ReactNode;
  categories: CardCategory[];
}) {
  const talk = useTalk();
  return (
    <View style={styles.card} accessibilityLabel={talk.playerCard}>
      <View style={styles.head}>
        <OvrBadge value={overall} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      </View>
      <View style={{ gap: space.lg }}>
        {categories.map(({ key, nodeId, name: label, ...bar }) =>
          nodeId ? (
            <Link key={key} href={{ pathname: "/node/[id]", params: { id: nodeId } }} asChild>
              <Pressable>
                <StatBar label={label} {...bar} />
              </Pressable>
            </Link>
          ) : (
            <StatBar key={key} label={label} {...bar} />
          ),
        )}
      </View>
    </View>
  );
}

/** OVR, archetype and category bars for your own ratings. */
export function PlayerCard({ ratings, name }: { ratings: RatingsDto; name: string }) {
  const talk = useTalk();
  const { mode } = useScore();
  const root = ratings.nodes.find((n) => n.parentId === null);
  const categories = ratings.nodes.filter((n) => n.parentId === root?.id);
  return (
    <CardView
      name={name}
      overall={root?.value ?? 0}
      subtitle={`${ratings.archetype?.name ?? talk.unranked} · ${ratings.season.label}${mode === "growth" ? ` · ${talk.growthMode}` : ""}`}
      note={
        root?.projection != null
          ? `Projected ${formatScore(mode, root.projection, 0)} by season end${root.goal != null ? ` · goal ${formatScore(mode, root.goal, 0)}` : ""}`
          : undefined
      }
      categories={categories.map((c) => ({
        key: c.id,
        nodeId: c.id,
        name: c.name,
        value: c.value ?? 0,
        trend: c.trend,
        projection: c.projection,
        goal: c.goal,
      }))}
    />
  );
}

/**
 * Another player's shared card: Overall, archetype and categories only, in their own mode (a
 * growth card shows points gained, never ratings).
 */
export function PublicCard({ card, name }: { card: PublicCardDto; name: string }) {
  const talk = useTalk();
  return (
    <ScoreProvider mode={card.mode} values={[card.overall, ...card.categories.map((c) => c.value)]}>
      <CardView
        name={name}
        overall={card.overall}
        subtitle={`${card.archetype ?? talk.unranked} · ${card.seasonLabel}${card.mode === "growth" ? ` · ${talk.growthMode}` : ""}`}
        note={`${card.recappedDays} recapped day${card.recappedDays === 1 ? "" : "s"} this season${card.recappedDays < LEADERBOARD_MIN_RECAPPED_DAYS ? " · provisional" : ""}`}
        categories={card.categories.map((c) => ({ key: c.name, name: c.name, value: c.value }))}
      />
    </ScoreProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xl,
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: 1,
    borderRadius: 20,
    padding: space.xl,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  name: {
    color: colors.court100,
    fontFamily: fonts.heavy,
    fontSize: 26,
    textTransform: "uppercase",
  },
  subtitle: {
    color: colors.court300,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  note: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: space.xs,
  },
});
