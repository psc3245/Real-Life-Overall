import {
  addDays,
  BACKFILL_DAYS,
  formatHabitEntry,
  groupProgress,
  isDayHabitDone,
  TREND_THRESHOLD,
  type DayDto,
  type DayHabitDto,
  type RatedNodeDto,
  type RecapDto,
} from "@rlo/shared";
import { Link, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useActivity, useRatings } from "@/api/ratings";
import { DayPicker } from "@/components/DayPicker";
import { Delta } from "@/components/Delta";
import { FocusCard } from "@/components/FocusCard";
import { OvrBadge } from "@/components/ratings";
import { OvrChange } from "@/components/RecapPanel";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Loading,
  Muted,
  NeedsRating,
  Screen,
  Section,
} from "@/components/ui";
import { dayLabel, longDate } from "@/lib/format";
import { colors, fonts, space, tierColor } from "@/lib/theme";

const STATUS_LABEL: Record<DayDto["status"], string> = {
  open: "Not recapped yet",
  recapped: "Recapped",
  stale: "Edited since recap",
};

const openLog = (date: string, today: string) =>
  router.push(date === today ? "/log" : { pathname: "/log", params: { date } });

/** Today at a glance: what's done, what's left, and how the ratings are moving. Logging is /log. */
export default function TodayScreen() {
  const day = useDay(null);
  const ratings = useRatings();
  const refresh = () => Promise.all([day.refetch(), ratings.refetch()]);

  if (ratings.data === null) return <NeedsRating />;
  if (day.isPending) return <Loading title="Today" />;
  if (day.isError) {
    return (
      <Screen title="Today" onRefresh={refresh}>
        <ErrorNote error={day.error} onRetry={refresh} />
      </Screen>
    );
  }
  const d = day.data;

  return (
    <Screen
      eyebrow={longDate(d.today)}
      title="Today"
      subtitle={STATUS_LABEL[d.status]}
      onRefresh={refresh}
    >
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            title={d.status === "open" ? "Log today →" : "Open today's log →"}
            onPress={() => openLog(d.today, d.today)}
          />
        </View>
        <DayPicker today={d.today} onPick={(date) => openLog(date, d.today)} />
      </View>

      <MissedRecaps today={d.today} />
      <HabitsCard day={d} />
      {ratings.data && <RatingCard nodes={ratings.data.nodes} />}
      <JournalCard day={d} />
      <FocusCard />
      {d.recap ? (
        <RecapSummary title="Today's recap" recap={d.recap} date={d.date} today={d.today} />
      ) : (
        <YesterdayCard today={d.today} />
      )}
    </Screen>
  );
}

function HabitsCard({ day }: { day: DayDto }) {
  const scheduled = day.habits.filter((h) => h.scheduled);
  const extra = day.habits.filter(
    (h) => !h.scheduled && (h.entry || h.children?.some((c) => c.entry)),
  );
  const count = scheduled.filter(isDayHabitDone).length;

  return (
    <Section title="Habits" action={{ label: "Stats →", href: "/habits" }}>
      {scheduled.length === 0 && extra.length === 0 ? (
        <Muted>Nothing scheduled today.</Muted>
      ) : (
        <>
          {scheduled.length > 0 && (
            <View style={{ gap: space.xs }}>
              <Text style={styles.count}>
                {count}
                <Text style={{ color: colors.court500 }}>/{scheduled.length}</Text>
                <Text style={styles.countLabel}> done</Text>
              </Text>
              <View style={styles.meter}>
                <View
                  style={[styles.meterFill, { width: `${(100 * count) / scheduled.length}%` }]}
                />
              </View>
            </View>
          )}
          <View>
            {[...scheduled, ...extra].map((h) => (
              <HabitLine key={h.habit.id} item={h} day={day} />
            ))}
          </View>
        </>
      )}
    </Section>
  );
}

function HabitLine({ item, day }: { item: DayHabitDto; day: DayDto }) {
  const done = isDayHabitDone(item);
  return (
    <Pressable onPress={() => openLog(day.date, day.today)} style={styles.line}>
      <View style={styles.lineMain}>
        <SymbolView
          name={done ? "checkmark.circle.fill" : "circle"}
          tintColor={done ? colors.neon : colors.court500}
          size={20}
        />
        <Body style={{ flex: 1 }} numberOfLines={1}>
          {item.habit.name}
          {!item.scheduled && <Text style={styles.bonus}> bonus</Text>}
        </Body>
        <Muted numberOfLines={1} style={{ maxWidth: "40%" }}>
          {item.habit.type === "group"
            ? groupProgress(item)
            : item.entry
              ? formatHabitEntry(item.habit.type, item.habit.config, item.entry)
              : "to do"}
        </Muted>
      </View>
      {item.children?.map((c) => (
        <View key={c.habit.id} style={styles.child}>
          <Muted style={isDayHabitDone(c) ? { color: colors.court100 } : undefined}>
            {isDayHabitDone(c) ? "✓ " : "○ "}
            {c.habit.name}
          </Muted>
          <Muted>{c.entry ? formatHabitEntry(c.habit.type, c.habit.config, c.entry) : ""}</Muted>
        </View>
      ))}
    </Pressable>
  );
}

function RatingCard({ nodes }: { nodes: RatedNodeDto[] }) {
  const root = nodes.find((n) => n.parentId === null);
  if (root?.value == null) return null;
  const parents = new Set(nodes.map((n) => n.parentId));
  const movers = nodes
    .filter((n) => !parents.has(n.id) && n.trend != null && Math.abs(n.trend) >= TREND_THRESHOLD)
    .sort((a, b) => Math.abs(b.trend!) - Math.abs(a.trend!))
    .slice(0, 4);

  return (
    <Section title="Your rating" action={{ label: "Full rating →", href: "/ratings" }}>
      <View style={styles.rating}>
        <OvrBadge value={root.value} size={72} />
        <View style={{ flex: 1, gap: space.xs }}>
          {root.trend != null && (
            <Muted>
              <Delta value={root.trend} /> in the last 7 days
            </Muted>
          )}
          {root.projection != null && (
            <Muted style={{ color: colors.court500 }}>
              Projected {root.projection.toFixed(1)} at season end
            </Muted>
          )}
        </View>
      </View>
      {movers.map((n) => (
        <Link key={n.id} href={{ pathname: "/node/[id]", params: { id: n.id } }} asChild>
          <Pressable style={styles.mover}>
            <Text style={{ flex: 1 }} numberOfLines={1}>
              <Text style={{ color: tierColor(n.trend! > 0 ? 85 : 0) }}>
                {n.trend! > 0 ? "▲ hot " : "▼ cold "}
              </Text>
              <Text style={{ color: colors.court100 }}>{n.name}</Text>
            </Text>
            <Delta value={n.trend!} />
          </Pressable>
        </Link>
      ))}
    </Section>
  );
}

function JournalCard({ day }: { day: DayDto }) {
  const text = day.journal.trim();
  const answered = day.prompts.filter((p) => p.answer?.trim()).length;
  return (
    <Section title="Journal" action={{ label: text ? "Keep writing →" : "Write →", href: "/log" }}>
      {text ? (
        <Muted numberOfLines={4}>{text}</Muted>
      ) : (
        <Muted style={{ color: colors.court500 }}>Nothing written yet today.</Muted>
      )}
      {day.prompts.length > 0 && (
        <Muted style={styles.small}>
          {answered}/{day.prompts.length} guided questions answered
        </Muted>
      )}
    </Section>
  );
}

function RecapSummary({
  title,
  recap,
  date,
  today,
}: {
  title: string;
  recap: RecapDto;
  date: string;
  today: string;
}) {
  const top = [...recap.changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
  return (
    <Section
      title={title}
      action={{
        label: "Full recap →",
        href: date === today ? "/log" : { pathname: "/log", params: { date } },
      }}
    >
      <OvrChange before={recap.overallBefore} after={recap.overallAfter} />
      <Body>{recap.narrative}</Body>
      {top.map((c) => (
        <Link key={c.nodeId} href={{ pathname: "/node/[id]", params: { id: c.nodeId } }} asChild>
          <Pressable style={styles.change}>
            <Delta value={c.delta} style={{ width: 52 }} />
            <Text style={{ flex: 1, color: colors.court300, fontSize: 14 }}>
              <Text style={{ color: colors.court100, fontWeight: "600" }}>{c.nodeName}</Text>{" "}
              {c.reason}
            </Text>
          </Pressable>
        </Link>
      ))}
    </Section>
  );
}

function YesterdayCard({ today }: { today: string }) {
  const yesterday = addDays(today, -1);
  const day = useDay(yesterday);
  if (!day.data?.recap) return null;
  return (
    <RecapSummary title="Yesterday's recap" recap={day.data.recap} date={yesterday} today={today} />
  );
}

/** Past days in the backfill window that have entries but no current recap. */
function MissedRecaps({ today }: { today: string }) {
  const activity = useActivity(BACKFILL_DAYS + 1);
  const missed = (activity.data ?? []).filter((a) => a.date < today && a.logged && !a.recapped);
  if (!missed.length) return null;
  return (
    <Card style={styles.missed}>
      <Body>
        {missed.length === 1 ? "A logged day hasn't" : `${missed.length} logged days haven't`} been
        recapped:
      </Body>
      <View style={styles.missedDays}>
        {missed.map((a) => (
          <Pressable key={a.date} onPress={() => openLog(a.date, today)} hitSlop={6}>
            <Text style={{ color: colors.neon, fontSize: 15 }}>{dayLabel(a.date)}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  count: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 30 },
  countLabel: {
    color: colors.court300,
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.court700, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.neon, borderRadius: 3 },
  line: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
    gap: space.xs,
  },
  lineMain: { flexDirection: "row", alignItems: "center", gap: space.md },
  bonus: { color: colors.court500, fontSize: 12 },
  child: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 32 },
  rating: { flexDirection: "row", alignItems: "center", gap: space.lg },
  mover: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 2 },
  small: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: colors.court500 },
  change: { flexDirection: "row", gap: space.md, paddingVertical: 2 },
  missed: { gap: space.sm, borderColor: "rgba(255,159,28,0.4)" },
  missedDays: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
});
