import {
  BOSS_SOULS_BASE,
  DEATH_CAUSE_LABELS,
  formatSouls,
  SOFT_CAPS,
  SOULS_PER_HABIT,
  SOULS_PER_POINT,
  SOULS_PER_WORKOUT,
  STAT_LEVEL_MAX,
  type SoulDayDto,
  type SoulsDto,
  type SoulStatDto,
} from "@rlo/shared";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useLevelUp, useSouls } from "@/api/souls";
import { OvrBadge, StatBar } from "@/components/ratings";
import { HiddenRating, ScoreProvider } from "@/components/score";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Loading,
  Muted,
  Screen,
  Section,
  TextLink,
} from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { cap, useTalk } from "@/lib/talk";
import { colors, fonts, space, tierKeyColor } from "@/lib/theme";

/** Souls mode's level-up screen (DESIGN.md §4.7), as on the web's /bonfire. */
export default function BonfireScreen() {
  const talk = useTalk();
  const souls = useSouls();

  if (souls.isPending) return <Loading title={talk.souls.bonfire} />;
  if (souls.error instanceof ApiError && souls.error.status === 404) {
    return (
      <Screen title={talk.souls.bonfire}>
        <Body>
          This season isn&apos;t a {talk.souls.mode} season. You can pick {talk.souls.mode} when a
          new season starts.
        </Body>
        <TextLink href="/ratings">Back to your rating →</TextLink>
      </Screen>
    );
  }
  if (souls.isError) {
    return (
      <Screen title={talk.souls.bonfire}>
        <ErrorNote error={souls.error} onRetry={() => void souls.refetch()} />
      </Screen>
    );
  }

  const data = souls.data;
  const root = data.stats.find((s) => s.parentId === null);
  return (
    <ScoreProvider mode="souls" values={[]}>
      <Screen
        eyebrow={data.cycle > 0 ? `NG+${data.cycle > 1 ? data.cycle : ""}` : data.season.label}
        title={talk.souls.bonfire}
        subtitle={`${talk.souls.bonfireTagline}.`}
        onRefresh={() => souls.refetch()}
      >
        <Card style={styles.head}>
          {data.soulLevel !== null && <OvrBadge value={data.soulLevel} size={64} mode="souls" />}
          <View style={{ flex: 1, alignItems: "flex-end", gap: space.xs }}>
            <Text style={styles.held}>{formatSouls(Math.max(0, data.held))}</Text>
            <Muted style={styles.caps}>{talk.souls.souls} held</Muted>
            {data.carried > 0 && (
              <Muted style={{ fontSize: 12 }}>
                {formatSouls(data.carried)} carried from last season
              </Muted>
            )}
            {root && <HiddenRating rating={root.rating} />}
          </View>
        </Card>
        <Warnings data={data} />
        <Stats data={data} />
        <RunLog days={data.days} />
        <Rules />
      </Screen>
    </ScoreProvider>
  );
}

function Warnings({ data }: { data: SoulsDto }) {
  const talk = useTalk();
  return (
    <>
      {data.bloodstain && (
        <Card style={[{ gap: space.xs }, styles.stain]}>
          <Text style={styles.stainTitle}>
            {talk.souls.bloodstain}: {formatSouls(data.bloodstain.amount)} {talk.souls.souls}
          </Text>
          <Muted>
            Dropped {dayLabel(data.bloodstain.date)}. End a day with no slips and no setback to pick
            them back up. Die again first and they&apos;re gone for good.
          </Muted>
        </Card>
      )}
      {data.held < 0 && (
        <Card>
          <Muted>
            You owe {formatSouls(-data.held)} {talk.souls.souls}: a level was bought with{" "}
            {talk.souls.souls} a later {talk.souls.died.toLowerCase()} took back. New{" "}
            {talk.souls.souls} pay it off first.
          </Muted>
        </Card>
      )}
    </>
  );
}

function Stats({ data }: { data: SoulsDto }) {
  const root = data.stats.find((s) => s.parentId === null);
  const childrenOf = (id: string) => data.stats.filter((s) => s.parentId === id);
  const leafRows = (node: SoulStatDto): SoulStatDto[] => {
    const kids = childrenOf(node.id);
    return kids.length ? kids.flatMap(leafRows) : [node];
  };
  return (
    <>
      {(root ? childrenOf(root.id) : []).map((category) => (
        <Section
          key={category.id}
          title={`${category.name}${category.level !== null ? ` · ${category.level.toFixed(1)}` : ""}`}
        >
          {leafRows(category).map((stat) => (
            <StatRow key={stat.id} stat={stat} held={data.held} />
          ))}
        </Section>
      ))}
    </>
  );
}

function StatRow({ stat, held }: { stat: SoulStatDto; held: number }) {
  const talk = useTalk();
  const levelUp = useLevelUp();
  if (stat.level === null) return null;
  const capped = [...SOFT_CAPS].reverse().find((c) => stat.level! >= c.level);
  const affordable = stat.cost !== null && stat.cost <= held;
  return (
    <View style={{ gap: space.sm }}>
      <StatBar label={stat.name} value={stat.level} />
      <View style={styles.statFoot}>
        <Muted style={{ flex: 1, fontSize: 12 }}>
          {stat.gained > 0 ? `+${stat.gained} this season · ` : ""}
          {stat.cost === null
            ? `Maxed at ${STAT_LEVEL_MAX}`
            : `Next ${formatSouls(stat.cost)} ${talk.souls.souls}`}
          {capped ? ` · past the ${capped.level} soft cap` : ""}
        </Muted>
        {stat.cost !== null && (
          <View style={{ minWidth: 120 }}>
            <Button
              title={talk.souls.levelUp}
              variant={affordable ? "primary" : "ghost"}
              disabled={!affordable}
              busy={levelUp.isPending}
              onPress={() => levelUp.mutate({ nodeId: stat.id })}
            />
          </View>
        )}
      </View>
      <ErrorNote error={levelUp.error} />
    </View>
  );
}

function RunLog({ days }: { days: SoulDayDto[] }) {
  const talk = useTalk();
  return (
    <Section title="The run">
      {days.slice(0, 14).map((d) => {
        const parts = (
          [
            ["recap", d.earned.recap],
            ["weekly review", d.earned.weekly],
            ["habits", d.earned.habits],
            ["workouts", d.earned.workouts],
            [talk.souls.boss.toLowerCase(), d.earned.bosses],
          ] as [string, number][]
        ).filter(([, n]) => n !== 0);
        const earned = parts.reduce((s, [, n]) => s + n, 0);
        return (
          <View key={d.date} style={styles.day}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>
                {dayLabel(d.date)}
                {d.open ? "  · in play" : ""}
                {d.paused ? "  · paused" : ""}
              </Body>
              {parts.length > 0 && (
                <Muted style={{ fontSize: 12 }}>
                  {parts.map(([k, n]) => `${n > 0 ? "+" : ""}${formatSouls(n)} ${k}`).join(" · ")}
                </Muted>
              )}
              {d.deaths.length > 0 && (
                <Text style={{ color: colors.flare }}>
                  {talk.souls.died}: {d.deaths.map((c) => DEATH_CAUSE_LABELS[c]).join(", ")}
                </Text>
              )}
              {d.recovered > 0 && (
                <Text style={{ color: tierKeyColor("green") }}>
                  Picked up {formatSouls(d.recovered)} {talk.souls.souls}
                </Text>
              )}
              {d.lost > 0 && (
                <Muted>
                  Lost {formatSouls(d.lost)} {talk.souls.souls} for good
                </Muted>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: earned > 0 ? colors.neon : colors.court500 }}>
                {earned > 0 ? "+" : ""}
                {formatSouls(earned)}
              </Text>
              {d.spent > 0 && <Muted>−{formatSouls(d.spent)} spent</Muted>}
              {d.dropped > 0 && (
                <Text style={{ color: colors.flare }}>{formatSouls(d.dropped)} dropped</Text>
              )}
            </View>
          </View>
        );
      })}
    </Section>
  );
}

function Rules() {
  const talk = useTalk();
  const s = talk.souls.souls;
  return (
    <Section title={`How ${talk.souls.mode} works`}>
      <Muted>
        {cap(s)} come from each day: {SOULS_PER_POINT} per rating point the recap gives,{" "}
        {SOULS_PER_HABIT} per habit done, {SOULS_PER_WORKOUT} per workout, and at least{" "}
        {BOSS_SOULS_BASE} for every goal you beat. Weekly reviews can add or take back {s}.
      </Muted>
      <Muted>
        Spend {s} to raise any attribute one level, up to {STAT_LEVEL_MAX}. Each level costs more
        than the last, and more again past levels {SOFT_CAPS.map((c) => c.level).join(" and ")}.
        Levels never fade.
      </Muted>
      <Muted>
        A day with nothing logged, a slip on an avoid habit, or a setback day drops your unspent {s}{" "}
        as a {talk.souls.bloodstain.toLowerCase()}. End your next day cleanly to pick it up; die
        again first and it&apos;s gone. Pauses protect you.
      </Muted>
    </Section>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  held: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 40 },
  caps: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  stain: { borderColor: colors.flare },
  stainTitle: {
    color: colors.flare,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  statFoot: { flexDirection: "row", alignItems: "center", gap: space.sm },
  day: {
    flexDirection: "row",
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
    paddingTop: space.sm,
  },
});
