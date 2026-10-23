import type { RatedNodeDto, SeasonDetailDto, SeasonDetailNode } from "@rlo/shared";
import { Link, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useSeasonDetail } from "@/api/seasons";
import { Medallion } from "@/components/badges";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { Delta } from "@/components/Delta";
import { OvrBadge, StatBar } from "@/components/ratings";
import { EarlierWeek } from "@/components/ReviewCard";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Body, Card, ErrorNote, Label, Loading, Muted, Screen, Section } from "@/components/ui";
import { seasonDates } from "@/lib/format";
import { colors, space } from "@/lib/theme";

/** HistoryChart reads rated nodes; a season's nodes carry only what the chart needs. */
const asRated = (nodes: SeasonDetailNode[]): RatedNodeDto[] =>
  nodes.map((n, i) => ({
    id: n.id,
    parentId: n.parentId,
    name: n.name,
    description: "",
    depth: n.depth,
    weight: 1,
    sortOrder: i,
    templateKey: null,
    value: n.end,
    rationale: null,
    confidence: null,
    decay: null,
    trend: null,
    goal: null,
    projection: null,
  }));

const change = (n: SeasonDetailNode) =>
  n.start !== null && n.end !== null ? n.end - n.start : null;

/** One season in full: how Overall and each category moved, the stats, badges and weeks. */
export default function SeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useSeasonDetail(id);
  if (detail.isPending) return <Loading />;
  if (detail.isError) {
    return (
      <Screen>
        {detail.error instanceof ApiError && detail.error.status === 404 ? (
          <Card>
            <Muted>Season not found.</Muted>
          </Card>
        ) : (
          <ErrorNote error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </Screen>
    );
  }
  return <Season s={detail.data} />;
}

function Season({ s }: { s: SeasonDetailDto }) {
  const root = s.nodes.find((n) => n.parentId === null);
  const categories = s.nodes.filter((n) => n.parentId === root?.id);
  const leaves = s.nodes.filter((n) => !s.nodes.some((c) => c.parentId === n.id));
  const movers = leaves
    .filter((n) => change(n) !== null && Math.abs(change(n)!) >= 0.05)
    .sort((a, b) => Math.abs(change(b)!) - Math.abs(change(a)!))
    .slice(0, 6);
  const names = new Map(s.nodes.map((n) => [n.id, n.name]));
  // Node pages only exist for the current season's tree.
  const nodeLink = (n: SeasonDetailNode, children: ReactNode) =>
    s.current ? (
      <Link href={{ pathname: "/node/[id]", params: { id: n.id } }}>{children}</Link>
    ) : (
      children
    );

  return (
    <Screen
      eyebrow={s.current ? "In progress" : "Final"}
      title={s.label}
      subtitle={`${seasonDates(s.startsOn, s.endsOn)}${s.archetype ? ` · ${s.archetype}` : ""}`}
    >
      {root?.end != null && (
        <View style={styles.hero}>
          <OvrBadge value={root.end} size={64} />
          {root.start !== null && (
            <Muted>
              Started at {root.start.toFixed(1)}
              {"\n"}
              <Delta value={root.end - root.start} style={{ fontSize: 18 }} />{" "}
              {s.current ? "so far" : "over the season"}
            </Muted>
          )}
        </View>
      )}

      <StatGrid>
        <StatTile label="Days logged" value={s.stats.daysLogged} />
        <StatTile label="Recapped" value={s.stats.daysRecapped} />
        <StatTile label="Best streak" value={s.stats.bestLoggingStreak} />
        <StatTile label="Habits done" value={s.stats.habitCompletions} />
        <StatTile label="Weekly reviews" value={s.stats.weeklyReviews} />
      </StatGrid>

      {s.history.dates.length > 1 && (
        <Section title="History">
          <HistoryChart history={s.history} nodes={asRated(s.nodes)} />
        </Section>
      )}

      <Label>Categories</Label>
      {categories.map((c) => {
        const attrs = s.nodes.filter((n) => n.parentId === c.id);
        return (
          <Card key={c.id} style={{ gap: space.md }}>
            {nodeLink(c, <StatBar label={c.name} value={c.end ?? 0} />)}
            <StartEnd node={c} />
            {attrs.length > 0 && (
              <View style={styles.attrs}>
                {attrs.map((a) => (
                  <View key={a.id} style={styles.attr}>
                    <Body style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                      {nodeLink(a, a.name)}
                    </Body>
                    <StartEnd node={a} />
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
      {movers.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Biggest moves</Label>
          {movers.map((n) => (
            <View key={n.id} style={styles.mover}>
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {nodeLink(n, n.name)}
              </Body>
              <Delta value={change(n)!} />
            </View>
          ))}
        </View>
      )}

      {s.badges.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Badges earned</Label>
          <View style={styles.badges}>
            {s.badges.map((b) => (
              <View key={`${b.key}-${b.tier}`} style={styles.badge}>
                <Medallion tier={b.tier} size={26} />
                <Text style={{ color: colors.court100, fontSize: 14 }}>{b.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {s.weeks.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Weekly reviews</Label>
          {s.weeks.map((w) => (
            <EarlierWeek key={w.id} week={w} names={names} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function StartEnd({ node }: { node: SeasonDetailNode }) {
  const d = change(node);
  return (
    <View style={styles.startEnd}>
      <Muted style={{ fontSize: 13, color: colors.court500 }}>
        {node.start?.toFixed(1) ?? "–"} → {node.end?.toFixed(1) ?? "–"}
      </Muted>
      {d !== null && <Delta value={d} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  attrs: {
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
    paddingTop: space.sm,
  },
  attr: { flexDirection: "row", alignItems: "center", gap: space.md },
  mover: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.court800,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
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
  startEnd: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
