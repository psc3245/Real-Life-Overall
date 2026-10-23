import {
  HABIT_STAT_RANGES,
  HABIT_TYPE_LABELS,
  type HabitStatRange,
  type HabitStatsDto,
} from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHabitStats } from "@/api/days";
import { useRatings } from "@/api/ratings";
import { Segmented } from "@/components/controls";
import { DayStrip } from "@/components/DayStrip";
import { NodeChip } from "@/components/NodeChip";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Body, Card, ErrorNote, Loading, Muted, Screen, TextLink } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { scheduleLabel } from "@/lib/habits";
import { colors, fonts, space } from "@/lib/theme";

const RANGES = HABIT_STAT_RANGES.map((r) => ({
  value: r,
  label: { week: "Week", month: "Month", season: "Season" }[r],
}));

const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/** Every habit's completion, averages and streaks for this week, month or season. */
export default function HabitsScreen() {
  const [range, setRange] = useState<HabitStatRange>("week");
  const stats = useHabitStats(range);
  const ratings = useRatings();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  const all = stats.data?.habits ?? [];
  // Groups count once (their sub-habits show inside the group's card).
  const habits = all.filter((h) => !h.habit.parentId);
  const scheduled = habits.reduce((n, h) => n + h.scheduled, 0);
  const completed = habits.reduce((n, h) => n + h.completed, 0);
  const remaining = habits.reduce((n, h) => n + h.remaining, 0);
  const hottest = habits.reduce<HabitStatsDto | null>(
    (best, h) => (h.currentStreak > (best?.currentStreak ?? 0) ? h : best),
    null,
  );

  if (stats.isPending && !stats.data) return <Loading title="Habits" />;

  return (
    <Screen
      eyebrow="At a glance"
      title="Habits"
      subtitle={stats.data ? `${shortDate(stats.data.start)} – ${shortDate(stats.data.end)}` : ""}
      onRefresh={() => stats.refetch()}
    >
      <View style={styles.bar}>
        <Segmented label="Period" options={RANGES} value={range} onChange={setRange} />
        <TextLink href="/habits/manage">Manage →</TextLink>
      </View>
      <ErrorNote error={stats.error} onRetry={() => void stats.refetch()} />

      {stats.data && habits.length === 0 && (
        <Card>
          <Muted>No habits yet. Add your first one under Manage.</Muted>
        </Card>
      )}

      {habits.length > 0 && (
        <StatGrid>
          <StatTile label="Completion" value={pct(scheduled ? completed / scheduled : null)} />
          <StatTile label="Done" value={`${completed}/${scheduled}`} />
          <StatTile label={`Left this ${range}`} value={String(remaining)} />
          <StatTile
            label="Best streak going"
            value={hottest ? String(hottest.currentStreak) : "0"}
            detail={hottest?.habit.name}
          />
        </StatGrid>
      )}

      {habits.map((h) => (
        <HabitCard
          key={h.habit.id}
          stats={h}
          subs={all.filter((c) => c.habit.parentId === h.habit.id)}
          range={range}
          today={stats.data!.today}
          names={names}
        />
      ))}
    </Screen>
  );
}

function HabitCard({
  stats: s,
  subs,
  range,
  today,
  names,
}: {
  stats: HabitStatsDto;
  subs: HabitStatsDto[];
  range: HabitStatRange;
  today: string;
  names: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const { habit } = s;
  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{habit.name}</Text>
          <Muted style={styles.meta}>
            {HABIT_TYPE_LABELS[habit.type]} · {scheduleLabel(habit.days)}
          </Muted>
          {habit.links.length > 0 && (
            <View style={styles.chips}>
              {habit.links.map((id) => (
                <NodeChip key={id} id={id} name={names.get(id)} />
              ))}
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.rate}>{pct(s.rate)}</Text>
          <Muted style={styles.meta}>
            {s.completed}/{s.scheduled} done
          </Muted>
        </View>
      </View>

      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${Math.round((s.rate ?? 0) * 100)}%` }]} />
      </View>

      <View style={styles.facts}>
        <Fact label={`Left this ${range}`} value={`${s.remaining}`} />
        {s.average !== null && (
          <Fact
            label="Avg"
            value={`${s.average}${s.target !== null ? ` / ${s.target}` : ""}`}
            suffix={habit.type === "duration" ? "min" : (habit.config.unit ?? "")}
          />
        )}
        <Fact label="Streak" value={String(s.currentStreak)} />
        <Fact
          label="Best"
          value={String(s.bestStreak)}
          suffix={s.bestStreakEnd ? `(to ${shortDate(s.bestStreakEnd)})` : ""}
        />
        {s.bonus > 0 && <Fact label="Bonus days" value={String(s.bonus)} />}
      </View>

      <DayStrip days={s.days} range={range} today={today} />

      {subs.length > 0 && (
        <View style={styles.subs}>
          {subs.map((c) => (
            <View key={c.habit.id} style={styles.sub}>
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {c.habit.name}
              </Body>
              <Muted>
                {c.completed}/{c.scheduled}
              </Muted>
              <Text style={styles.subRate}>{pct(c.rate)}</Text>
            </View>
          ))}
        </View>
      )}

      {s.recent.length > 0 && (
        <View style={{ gap: space.xs }}>
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6}>
            <Muted>{open ? "Hide recent entries ▲" : "Recent entries ▼"}</Muted>
          </Pressable>
          {open &&
            s.recent.map((r) => (
              <Pressable
                key={r.date}
                style={styles.recent}
                onPress={() => router.push({ pathname: "/log", params: { date: r.date } })}
              >
                <Text style={styles.recentDate}>{shortDate(r.date)}</Text>
                <Body style={{ flex: 1, fontSize: 14 }}>{r.value}</Body>
              </Pressable>
            ))}
        </View>
      )}
    </Card>
  );
}

function Fact({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Text style={styles.fact}>
      <Text style={styles.factLabel}>{label} </Text>
      {value}
      {suffix ? <Text style={{ color: colors.court500 }}> {suffix}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHead: { flexDirection: "row", gap: space.md },
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  meta: { fontSize: 12, color: colors.court500 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  rate: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 30 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.court700, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.neon, borderRadius: 3 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  fact: { color: colors.court100, fontSize: 14 },
  factLabel: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  subs: {
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
    paddingTop: space.sm,
  },
  sub: { flexDirection: "row", alignItems: "center", gap: space.md },
  subRate: { color: colors.court100, fontFamily: fonts.display, width: 44, textAlign: "right" },
  recent: { flexDirection: "row", gap: space.md },
  recentDate: { color: colors.court500, width: 56, fontSize: 14 },
});
