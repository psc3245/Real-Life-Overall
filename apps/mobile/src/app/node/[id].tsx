import type { RatedNodeDto } from "@rlo/shared";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHabitStats } from "@/api/days";
import { useChangeFeed, useHistory, useRatings } from "@/api/ratings";
import { ChangeList } from "@/components/ChangeList";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { Delta } from "@/components/Delta";
import { GoalEditor } from "@/components/GoalEditor";
import { ChartButton } from "@/components/ChartButton";
import { StatBar } from "@/components/ratings";
import { formatScore, HiddenRating, scoreColor, useScore } from "@/components/score";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Label,
  Loading,
  Muted,
  Screen,
  Section,
  TextLink,
} from "@/components/ui";
import { CONFIDENCE_LABEL } from "@/lib/labels";
import { colors, fonts, space } from "@/lib/theme";

/** Everything about one attribute or category: value, history, why it moved, what feeds it. */
export default function NodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ratings = useRatings();
  if (ratings.isPending) return <Loading />;
  if (ratings.isError) {
    return (
      <Screen>
        <ErrorNote error={ratings.error} onRetry={() => void ratings.refetch()} />
      </Screen>
    );
  }
  const nodes = ratings.data?.nodes ?? [];
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    return (
      <Screen>
        <Card>
          <Muted>Not in this season&apos;s tree.</Muted>
        </Card>
      </Screen>
    );
  }
  // Remount per node so paging and charts reset.
  return <NodeDetail key={node.id} node={node} nodes={nodes} />;
}

function NodeDetail({ node, nodes }: { node: RatedNodeDto; nodes: RatedNodeDto[] }) {
  const { mode } = useScore();
  const history = useHistory(90);
  const feed = useChangeFeed({ nodeId: node.id });
  const habits = useHabitStats("week");

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ancestors: RatedNodeDto[] = [];
  for (let p = node.parentId ? byId.get(node.parentId) : undefined; p;) {
    ancestors.unshift(p);
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  const children = nodes.filter((n) => n.parentId === node.id);
  const below = new Set([node.id]);
  for (let size = 0; size !== below.size;) {
    size = below.size;
    for (const n of nodes) if (n.parentId && below.has(n.parentId)) below.add(n.id);
  }
  const linked = (habits.data?.habits ?? []).filter((h) => h.habit.links.some((l) => below.has(l)));
  const color = scoreColor(mode, node.value ?? 0);
  const changes = feed.data?.pages.flat() ?? [];
  const crumbs = ancestors.filter((a) => a.parentId !== null);

  return (
    <Screen
      eyebrow={["Rating", ...crumbs.map((a) => a.name)].join(" › ")}
      title={node.name}
      onRefresh={() => Promise.all([history.refetch(), feed.refetch()])}
    >
      {node.description ? <Muted>{node.description}</Muted> : null}
      <View style={styles.value}>
        <Text style={[styles.big, { color }]}>
          {node.value == null ? "—" : formatScore(mode, node.value)}
        </Text>
        {mode === "growth" && <Muted style={{ fontSize: 12 }}>gained this season</Muted>}
        <HiddenRating rating={node.rating} />
        <ChartButton
          ids={[`rating:${node.id}`]}
          config={{ range: "season", trend: true }}
          label="Chart and model →"
        />
        {node.trend != null && (
          <Muted>
            <Delta value={node.trend} /> in 7 days
          </Muted>
        )}
      </View>
      <GoalEditor node={node} />

      {(node.rationale || node.decay || node.confidence) && (
        <Section title="Why it's rated this way">
          {node.rationale && <Body>{node.rationale}</Body>}
          <View style={styles.facts}>
            {node.confidence && <Muted>{CONFIDENCE_LABEL[node.confidence]}</Muted>}
            {node.decay && (
              <Muted>
                <Text style={{ color: colors.court500 }}>Decay </Text>
                {node.decay.perDay}/day after {node.decay.graceDays} idle day
                {node.decay.graceDays === 1 ? "" : "s"}, floor {node.decay.floor}
              </Muted>
            )}
          </View>
          {node.decay?.notes ? (
            <Muted style={{ color: colors.court500 }}>{node.decay.notes}</Muted>
          ) : null}
        </Section>
      )}

      <Section title="History">
        {history.data ? (
          <HistoryChart history={history.data} nodes={nodes} only={node} />
        ) : (
          <Muted>Loading…</Muted>
        )}
      </Section>

      {children.length > 0 && (
        <Section title="Made up of">
          {children.map((c) => (
            <Link key={c.id} href={{ pathname: "/node/[id]", params: { id: c.id } }} asChild>
              <Pressable>
                <StatBar label={c.name} value={c.value} trend={c.trend} goal={c.goal} />
              </Pressable>
            </Link>
          ))}
        </Section>
      )}

      <View style={{ gap: space.sm }}>
        <View style={styles.head}>
          <Label>Habits that feed it</Label>
          <TextLink href="/habits">Habit stats →</TextLink>
        </View>
        {linked.length ? (
          <Card style={{ padding: 0 }}>
            {linked.map((h, i) => (
              <View key={h.habit.id} style={[styles.habit, i > 0 && styles.border]}>
                <Body style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
                  {h.habit.name}
                </Body>
                <Muted style={{ fontSize: 13 }}>
                  {h.completed}/{h.scheduled + h.remaining} this week · streak {h.currentStreak}
                </Muted>
              </View>
            ))}
          </Card>
        ) : (
          <Muted>
            No habits linked yet.{" "}
            <Text style={{ color: colors.neon }} onPress={() => router.push("/habits/manage")}>
              Link one
            </Text>{" "}
            so recaps know what builds it.
          </Muted>
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <View style={styles.head}>
          <Label>Changes this season</Label>
          <TextLink href={{ pathname: "/activity", params: { node: node.id } }}>
            In the feed →
          </TextLink>
        </View>
        <ErrorNote error={feed.error} />
        {changes.length ? (
          <ChangeList items={changes} showDates />
        ) : (
          feed.data && <Muted>No changes yet.</Muted>
        )}
        {feed.hasNextPage && (
          <Button
            title={feed.isFetchingNextPage ? "Loading…" : "Load more"}
            variant="ghost"
            disabled={feed.isFetchingNextPage}
            onPress={() => void feed.fetchNextPage()}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  value: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  big: { fontFamily: fonts.heavy, fontSize: 56 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  habit: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
});
