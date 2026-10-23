import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRatings } from "@/api/ratings";
import { useSeasonCards } from "@/api/seasons";
import { OvrBadge } from "@/components/ratings";
import { Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { seasonDates } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";

/** Every season: the one in progress first, then archived ones, newest first. */
export default function HistoryScreen() {
  const ratings = useRatings();
  const cards = useSeasonCards();
  if (ratings.isPending || cards.isPending) return <Loading />;
  const error = ratings.error ?? cards.error;
  if (error) {
    return (
      <Screen>
        <ErrorNote error={error} />
      </Screen>
    );
  }

  const live = ratings.data;
  const root = live?.nodes.find((n) => n.parentId === null);
  const rows = [
    ...(live
      ? [
          {
            id: live.season.id,
            label: live.season.label,
            dates: seasonDates(live.season.startsOn, live.season.endsOn),
            overall: root?.value ?? null,
            archetype: live.archetype?.name ?? null,
            categories: live.nodes
              .filter((n) => n.parentId === root?.id)
              .map((n) => ({ name: n.name, value: n.value })),
            current: true,
          },
        ]
      : []),
    ...(cards.data ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      dates: seasonDates(c.startsOn, c.endsOn),
      overall: c.overall,
      archetype: c.archetype,
      categories: c.nodes
        .filter((n) => n.depth === 1)
        .map((n) => ({ name: n.name, value: n.value })),
      current: false,
    })),
  ];

  return (
    <Screen eyebrow="Seasons" title="History">
      <Muted>Each calendar quarter is a season. Open one to see how it went.</Muted>
      {rows.length === 0 && (
        <Card>
          <Muted>Your first season starts when you finish onboarding.</Muted>
        </Card>
      )}
      {rows.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push({ pathname: "/history/[id]", params: { id: r.id } })}
        >
          <Card style={styles.row}>
            {r.overall !== null ? (
              <OvrBadge value={r.overall} size={48} />
            ) : (
              <View style={styles.empty} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{r.label}</Text>
                {r.current && <Text style={styles.live}>In progress</Text>}
              </View>
              <Muted style={{ fontSize: 13, color: colors.court500 }}>
                {r.dates}
                {r.archetype && ` · ${r.archetype}`}
              </Muted>
              <Muted numberOfLines={1} style={{ fontSize: 13 }}>
                {r.categories
                  .map((c) => `${c.name} ${c.value === null ? "–" : c.value.toFixed(0)}`)
                  .join(" · ")}
              </Muted>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  empty: { width: 62, height: 62, borderRadius: 16, borderWidth: 2, borderColor: colors.court700 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  live: {
    color: colors.neon,
    fontSize: 11,
    borderWidth: 1,
    borderColor: "rgba(60,242,200,0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
});
