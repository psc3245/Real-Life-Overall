import { LEADERBOARD_MIN_RECAPPED_DAYS, type PublicCardDto, type RatingsDto } from "@rlo/shared";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";
import { OvrBadge, StatBar } from "./ratings";

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
  return (
    <View style={styles.card} accessibilityLabel="Player card">
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
  const root = ratings.nodes.find((n) => n.parentId === null);
  const categories = ratings.nodes.filter((n) => n.parentId === root?.id);
  return (
    <CardView
      name={name}
      overall={root?.value ?? 0}
      subtitle={`${ratings.archetype?.name ?? "Unranked"} · ${ratings.season.label}`}
      note={
        root?.projection != null
          ? `Projected ${Math.round(root.projection)} by season end${root.goal != null ? ` · goal ${Math.round(root.goal)}` : ""}`
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

/** Another player's shared card: Overall, archetype and categories only. */
export function PublicCard({ card, name }: { card: PublicCardDto; name: string }) {
  return (
    <CardView
      name={name}
      overall={card.overall}
      subtitle={`${card.archetype ?? "Unranked"} · ${card.seasonLabel}`}
      note={`${card.recappedDays} recapped day${card.recappedDays === 1 ? "" : "s"} this season${card.recappedDays < LEADERBOARD_MIN_RECAPPED_DAYS ? " · provisional" : ""}`}
      categories={card.categories.map((c) => ({ key: c.name, name: c.name, value: c.value }))}
    />
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
