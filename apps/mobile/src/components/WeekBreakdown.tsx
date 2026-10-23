import {
  addDays,
  dayOfWeek,
  daysBetween,
  MAX_HISTORY_DAYS,
  WEEKDAY_SHORT,
  type RatedNodeDto,
  type WeekRange,
} from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHabitStats } from "@/api/days";
import { useActivity, useHistory } from "@/api/ratings";
import { shortDate } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { DayStrip } from "./DayStrip";
import { Delta } from "./Delta";
import { StatGrid, StatTile } from "./StatTile";
import { Body, Card, Label, Muted, TextLink } from "./ui";

/**
 * The specifics of one week: logging and recaps per day, net rating movement, category moves
 * and each habit's week. `today` bounds a week that's still in progress.
 */
export function WeekBreakdown({
  week,
  today,
  nodes,
}: {
  week: WeekRange;
  today: string;
  nodes: RatedNodeDto[];
}) {
  // Activity and history are "last N days"; reach back to the day before the week.
  const span = Math.min(MAX_HISTORY_DAYS, daysBetween(addDays(week.start, -1), today) + 1);
  const activity = useActivity(span);
  const history = useHistory(span);
  const habits = useHabitStats("week", week.start);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const byDate = new Map((activity.data ?? []).map((a) => [a.date, a]));
  const past = dates.filter((d) => d <= today);
  const logged = past.filter((d) => byDate.get(d)?.logged).length;
  const recapped = past.filter((d) => byDate.get(d)?.recapped).length;
  // Groups count once; their sub-habits are covered by the group.
  const habitRows = (habits.data?.habits ?? []).filter((h) => !h.habit.parentId);
  const scheduled = habitRows.reduce((n, h) => n + h.scheduled, 0);
  const completed = habitRows.reduce((n, h) => n + h.completed, 0);

  // Node values the evening before the week and at its (latest) end.
  const valueAt = (nodeId: string, date: string) => {
    if (!history.data) return null;
    const i = history.data.dates.indexOf(date);
    const series = history.data.series.find((s) => s.nodeId === nodeId);
    if (i < 0 || !series) return null;
    return series.values[i] ?? null;
  };
  const endDate = week.end < today ? week.end : today;
  const firstDate = history.data?.dates[0];
  const before = (id: string) =>
    valueAt(id, addDays(week.start, -1)) ??
    (firstDate && firstDate >= week.start ? valueAt(id, firstDate) : null);
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const move = (id: string) => {
    const a = before(id);
    const b = valueAt(id, endDate);
    return a === null || b === null ? null : { from: a, to: b, delta: b - a };
  };
  const overall = root ? move(root.id) : null;

  const habitsOn = (date: string) => {
    const due = habitRows.filter((h) => h.days.find((d) => d.date === date)?.scheduled);
    return {
      due: due.length,
      done: due.filter((h) => h.days.find((d) => d.date === date)?.done).length,
    };
  };

  return (
    <View style={{ gap: space.lg }}>
      <StatGrid>
        <StatTile label="Days logged" value={`${logged}/${past.length}`} />
        <StatTile label="Recapped" value={`${recapped}/${past.length}`} />
        <StatTile
          label="Habits done"
          value={scheduled ? `${Math.round((100 * completed) / scheduled)}%` : "—"}
          detail={scheduled ? `${completed} of ${scheduled}` : undefined}
        />
        <StatTile
          label="Overall"
          value={overall ? overall.to.toFixed(1) : "—"}
          detail={overall ? <Delta value={overall.delta} /> : undefined}
        />
      </StatGrid>

      {categories.length > 0 && history.data && (
        <View style={{ gap: space.sm }}>
          <Label>Category moves</Label>
          {categories.map((c) => {
            const m = move(c.id);
            return (
              <View key={c.id} style={styles.move}>
                <Body style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </Body>
                {m ? (
                  <>
                    <Muted style={{ fontSize: 13, color: colors.court500 }}>
                      {m.from.toFixed(1)} → {m.to.toFixed(1)}
                    </Muted>
                    <Delta value={m.delta} />
                  </>
                ) : (
                  <Muted>—</Muted>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <Label>Day by day</Label>
        <Card style={{ padding: 0 }}>
          {dates.map((date, i) => {
            const a = byDate.get(date);
            const h = habitsOn(date);
            const net = a ? a.gain - a.loss : 0;
            const ahead = date > today;
            return (
              <Pressable
                key={date}
                disabled={ahead}
                onPress={() =>
                  router.push(date === today ? "/log" : { pathname: "/log", params: { date } })
                }
                style={[styles.day, i > 0 && styles.dayBorder, ahead && { opacity: 0.4 }]}
              >
                <View style={{ width: 64 }}>
                  <Text style={styles.weekday}>{WEEKDAY_SHORT[dayOfWeek(date)]}</Text>
                  <Muted style={{ fontSize: 12, color: colors.court500 }}>{shortDate(date)}</Muted>
                </View>
                <View style={styles.dayFacts}>
                  <Text style={{ color: a?.logged ? colors.court100 : colors.court500 }}>
                    {ahead ? "Ahead" : a?.logged ? "✓ Logged" : "Not logged"}
                  </Text>
                  {a?.recapped && <Muted>Recapped</Muted>}
                  {h.due > 0 && (
                    <Muted style={h.done === h.due ? { color: colors.neon } : undefined}>
                      Habits {h.done}/{h.due}
                    </Muted>
                  )}
                </View>
                {a && (a.gain || a.loss) ? (
                  <Delta value={net} />
                ) : (
                  <Text style={{ color: colors.court700 }}>—</Text>
                )}
              </Pressable>
            );
          })}
        </Card>
      </View>

      {habitRows.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Habits this week</Label>
          {habitRows.map((h) => (
            <Card key={h.habit.id} style={{ gap: space.sm }}>
              <View style={styles.habitHead}>
                <Body style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
                  {h.habit.name}
                </Body>
                <Muted>
                  {h.completed}/{h.scheduled + h.remaining}
                  {h.average !== null && (
                    <Text style={{ color: colors.court500 }}>
                      {" "}
                      · avg {h.average}
                      {h.target !== null && `/${h.target}`}
                    </Text>
                  )}
                </Muted>
              </View>
              <DayStrip days={h.days} range="week" today={today} />
            </Card>
          ))}
          <TextLink href="/habits">All habit stats →</TextLink>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  move: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.court800,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  day: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  dayBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  weekday: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 16,
    textTransform: "uppercase",
  },
  dayFacts: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: space.md },
  habitHead: { flexDirection: "row", alignItems: "baseline", gap: space.md },
});
