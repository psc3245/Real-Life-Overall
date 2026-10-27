import type { RatedNodeDto, RatingsDto } from "@rlo/shared";
import * as Sharing from "expo-sharing";
import { Link, router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useMe } from "@/api/hooks";
import { useActivity, useChangeFeed, useHistory, useRatings } from "@/api/ratings";
import { BadgesSection } from "@/components/BadgesSection";
import { ChangeList } from "@/components/ChangeList";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { ShapeRadar } from "@/components/charts/ShapeRadar";
import { DecayCard } from "@/components/DecayCard";
import { GoalEditor } from "@/components/GoalEditor";
import { PlayerCard } from "@/components/PlayerCard";
import { StatBar } from "@/components/ratings";
import { HiddenRating, useScore } from "@/components/score";
import { useTalk } from "@/lib/talk";
import { NewSeasonBanner, PastSeasons } from "@/components/SeasonSections";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Label,
  Loading,
  Muted,
  NeedsRating,
  Screen,
  Section,
  TextLink,
} from "@/components/ui";
import { CONFIDENCE_LABEL } from "@/lib/labels";
import { colors, space } from "@/lib/theme";

/** Card, scouting report, charts, badges, activity, the tree, seasons and decay. */
export default function RatingsScreen() {
  const talk = useTalk();
  const { mode } = useScore();
  const ratings = useRatings();
  const me = useMe();
  const refresh = () => ratings.refetch();

  if (ratings.isPending) return <Loading title="Ratings" />;
  if (ratings.isError) {
    return (
      <Screen title="Ratings" onRefresh={refresh}>
        <ErrorNote error={ratings.error} onRetry={refresh} />
      </Screen>
    );
  }
  if (!ratings.data) return <NeedsRating />;

  const data = ratings.data;
  const root = data.nodes.find((n) => n.parentId === null);
  const categories = data.nodes.filter((n) => n.parentId === root?.id);

  return (
    <Screen eyebrow={data.season.label} title="Ratings" onRefresh={refresh}>
      <NewSeasonBanner />
      <ExportableCard
        ratings={data}
        name={me.data?.displayName ?? "Player"}
        username={me.data?.username}
      />

      <Section title={talk.profileHeading}>
        {mode === "growth" && (
          <Card style={{ gap: space.xs, borderColor: colors.neonDim }}>
            <Muted>
              <Text style={{ color: colors.neon, fontWeight: "700" }}>{talk.growthMode}. </Text>
              Every number this season is points gained since it started. Gains add up; decay and
              off days never take them away. Your rating keeps running underneath, and only you can
              see it.
            </Muted>
            {root && <HiddenRating rating={root.rating} />}
          </Card>
        )}
        {data.archetype && (
          <Body>
            <Text style={{ color: colors.neon, fontWeight: "700" }}>{data.archetype.name}. </Text>
            <Text style={{ color: colors.court300 }}>{data.archetype.description}</Text>
          </Body>
        )}
        {data.summary && <Muted>{data.summary}</Muted>}
        {root && (
          <View style={styles.potential}>
            <Label>{mode === "growth" ? "Overall growth target" : "Overall potential"}</Label>
            <GoalEditor node={root} />
          </View>
        )}
        <Muted style={{ fontSize: 13, color: colors.court500 }}>
          {mode === "growth"
            ? "Tap any attribute to see where its gains came from."
            : "Tap any attribute to see why it's rated that way."}
        </Muted>
      </Section>
      <Pressable onPress={() => router.push("/scouting-report")}>
        <Card style={{ gap: 2 }}>
          <Text style={{ color: colors.neon, fontSize: 16, fontWeight: "600" }}>
            {talk.scoutingReport} →
          </Text>
          <Muted style={{ fontSize: 13 }}>
            {talk.scoutingReportTagline}, and how your rating is adapting to it.
          </Muted>
        </Card>
      </Pressable>

      <Charts ratings={data} />
      <BadgesSection />
      <RecentChanges />

      {categories.map((c) => (
        <Card key={c.id} style={{ gap: space.md }}>
          <Link href={{ pathname: "/node/[id]", params: { id: c.id } }} asChild>
            <Pressable>
              <StatBar
                label={c.name}
                value={c.value}
                trend={c.trend}
                projection={c.projection}
                goal={c.goal}
              />
            </Pressable>
          </Link>
          <HiddenRating rating={c.rating} />
          <View style={styles.catFoot}>
            <GoalEditor node={c} />
            <TextLink href={{ pathname: "/node/[id]", params: { id: c.id } }}>Details →</TextLink>
          </View>
          <View style={styles.children}>
            <Children ratings={data} parent={c} />
          </View>
        </Card>
      ))}

      <PastSeasons />
      <Button title="All seasons" variant="ghost" onPress={() => router.push("/history")} />
      <DecayCard />
    </Screen>
  );
}

function Children({ ratings, parent }: { ratings: RatingsDto; parent: RatedNodeDto }) {
  const children = ratings.nodes.filter((n) => n.parentId === parent.id);
  if (!children.length) return <Detail node={parent} />;
  return (
    <>
      {children.map((child) => {
        const grandchildren = ratings.nodes.some((n) => n.parentId === child.id);
        return grandchildren ? (
          <View key={child.id} style={styles.nested}>
            <Link href={{ pathname: "/node/[id]", params: { id: child.id } }} asChild>
              <Pressable>
                <StatBar label={child.name} value={child.value} trend={child.trend} />
              </Pressable>
            </Link>
            <Children ratings={ratings} parent={child} />
          </View>
        ) : (
          <AttributeRow key={child.id} node={child} />
        );
      })}
    </>
  );
}

function AttributeRow({ node }: { node: RatedNodeDto }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
      >
        <StatBar label={node.name} value={node.value} trend={node.trend} goal={node.goal} />
      </Pressable>
      {open && <Detail node={node} />}
    </View>
  );
}

function Detail({ node }: { node: RatedNodeDto }) {
  return (
    <View style={styles.detail}>
      <HiddenRating rating={node.rating} />
      {node.rationale && <Body style={{ fontSize: 15 }}>{node.rationale}</Body>}
      <TextLink href={{ pathname: "/node/[id]", params: { id: node.id } }}>
        History, changes and linked habits →
      </TextLink>
      <GoalEditor node={node} />
      <View style={styles.meta}>
        {node.confidence && (
          <Text style={styles.metaText}>{CONFIDENCE_LABEL[node.confidence]}</Text>
        )}
        {node.decay && (
          <Text style={styles.metaText}>
            Fades {node.decay.perDay}/day after {node.decay.graceDays} idle day
            {node.decay.graceDays === 1 ? "" : "s"} · floor {node.decay.floor}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The latest few changes; the full feed is its own screen. */
function RecentChanges() {
  const changes = useChangeFeed({
    sources: ["daily_recap", "weekly_review", "decay", "recalibration"],
    pageSize: 3,
  });
  const items = changes.data?.pages[0] ?? [];
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Label>Recent activity</Label>
        <TextLink href="/activity">All activity →</TextLink>
      </View>
      {items.length ? (
        <ChangeList items={items} showDates />
      ) : (
        <Muted>No changes since scouting yet.</Muted>
      )}
    </View>
  );
}

/** The player card plus sharing it as an image (the web's PNG download, DESIGN.md §7.1). */
function ExportableCard({
  ratings,
  name,
  username,
}: {
  ratings: RatingsDto;
  name: string;
  username?: string;
}) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const share = async () => {
    setExporting(true);
    setError(null);
    try {
      const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Couldn't create the image"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <View ref={card} collapsable={false} style={{ backgroundColor: colors.court950 }}>
        <PlayerCard ratings={ratings} name={name} />
      </View>
      <View style={styles.cardActions}>
        {username && (
          <View style={{ flex: 1 }}>
            <Button
              title="Profile"
              variant="ghost"
              onPress={() => router.push({ pathname: "/u/[username]", params: { username } })}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button
            title={exporting ? "Rendering…" : "Share card"}
            variant="ghost"
            disabled={exporting}
            onPress={() => void share()}
          />
        </View>
      </View>
      <ErrorNote error={error} />
    </View>
  );
}

function Charts({ ratings }: { ratings: RatingsDto }) {
  const history = useHistory(90);
  const activity = useActivity(119);
  return (
    <>
      <Section title="History">
        {history.data ? (
          <HistoryChart history={history.data} nodes={ratings.nodes} />
        ) : (
          <Muted>Loading…</Muted>
        )}
      </Section>
      <Section title="Shape">
        <ShapeRadar nodes={ratings.nodes} />
      </Section>
      <Section title="Consistency">
        {activity.data && <ActivityHeatmap days={activity.data} />}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  potential: {
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.court800,
    borderRadius: 10,
    padding: space.md,
  },
  catFoot: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
  },
  children: {
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
    paddingTop: space.md,
  },
  nested: {
    gap: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.court700,
    paddingLeft: space.md,
  },
  detail: {
    gap: space.sm,
    marginTop: space.sm,
    backgroundColor: colors.court950,
    borderRadius: 10,
    padding: space.md,
  },
  meta: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: space.xs },
  metaText: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardActions: { flexDirection: "row", gap: space.sm },
});
