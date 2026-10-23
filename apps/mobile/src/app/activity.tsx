import type { ChangeFeedItemDto } from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useChangeFeed, useRatings, type ChangeSource } from "@/api/ratings";
import { ChangeList } from "@/components/ChangeList";
import { Chip } from "@/components/controls";
import { Delta } from "@/components/Delta";
import { Button, Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";

const FILTERS: { key: string; label: string; sources?: ChangeSource[] }[] = [
  { key: "all", label: "All" },
  { key: "recaps", label: "Daily recaps", sources: ["daily_recap"] },
  { key: "weekly", label: "Weekly", sources: ["weekly_review"] },
  { key: "decay", label: "Decay", sources: ["decay"] },
  { key: "setup", label: "Scouting & seasons", sources: ["onboarding", "recalibration"] },
];

/** Every rating change this season, newest first, filterable by source and category. */
export default function ActivityScreen() {
  const params = useLocalSearchParams<{ source?: string; node?: string }>();
  const filter = FILTERS.find((f) => f.key === params.source) ?? FILTERS[0]!;
  const nodeId = params.node || undefined;
  const ratings = useRatings();
  const feed = useChangeFeed({ sources: filter.sources, nodeId });

  const nodes = ratings.data?.nodes ?? [];
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const items = feed.data?.pages.flat() ?? [];
  const groups = groupByDay(items);

  return (
    <Screen eyebrow="Rating" title="Activity" onRefresh={() => feed.refetch()}>
      <Muted>Every change to your ratings this season, and why.</Muted>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter.key === f.key}
            onPress={() => router.setParams({ source: f.key === "all" ? "" : f.key })}
          />
        ))}
      </ScrollView>
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="All categories"
            selected={!nodeId}
            onPress={() => router.setParams({ node: "" })}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={nodeId === c.id}
              onPress={() => router.setParams({ node: c.id })}
            />
          ))}
        </ScrollView>
      )}

      {feed.isPending && <Loading />}
      <ErrorNote error={feed.error} onRetry={() => void feed.refetch()} />
      {feed.data && items.length === 0 && (
        <Card>
          <Muted>No changes match.</Muted>
        </Card>
      )}

      {groups.map((g) => (
        <View key={g.key} style={{ gap: space.sm }}>
          <View style={styles.groupHead}>
            <Text style={styles.groupDate}>{g.date ? dayLabel(g.date) : "Undated"}</Text>
            <View style={styles.groupRight}>
              <Delta value={g.net} />
              {g.date && (
                <Pressable
                  hitSlop={6}
                  onPress={() => router.push({ pathname: "/log", params: { date: g.date! } })}
                >
                  <Text style={{ color: colors.court300, fontSize: 14 }}>Open day →</Text>
                </Pressable>
              )}
            </View>
          </View>
          <ChangeList items={g.items} />
        </View>
      ))}

      {feed.hasNextPage && (
        <Button
          title={feed.isFetchingNextPage ? "Loading…" : "Load more"}
          variant="ghost"
          disabled={feed.isFetchingNextPage}
          onPress={() => void feed.fetchNextPage()}
        />
      )}
    </Screen>
  );
}

function groupByDay(items: ChangeFeedItemDto[]) {
  const groups: { key: string; date: string | null; net: number; items: ChangeFeedItemDto[] }[] =
    [];
  for (const item of items) {
    const date = item.date ?? null;
    const key = date ?? "undated";
    let group = groups.at(-1);
    if (!group || group.key !== `${key}-${groups.length - 1}`) {
      group = { key: `${key}-${groups.length}`, date, net: 0, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    group.net = Math.round((group.net + item.delta) * 100) / 100;
  }
  return groups;
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  groupDate: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  groupRight: { flexDirection: "row", alignItems: "baseline", gap: space.md },
});
