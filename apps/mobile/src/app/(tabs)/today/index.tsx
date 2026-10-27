import {
  addDays,
  BACKFILL_DAYS,
  formatHabitEntry,
  groupProgress,
  isDayHabitDone,
  MAX_COACH_MESSAGE,
  rangeStart,
  seasonForDate,
  TODAY_WIDGET_FEATURE,
  TREND_THRESHOLD,
  type ChartViewDto,
  type DayDto,
  type TodayWidget,
  type DayHabitDto,
  type RatedNodeDto,
  type RecapDto,
} from "@rlo/shared";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useMe } from "@/api/hooks";
import { useChartViews, useMetricSeries } from "@/api/metrics";
import { usePreferences } from "@/api/preferences";
import { MetricChart } from "@/components/charts/MetricChart";
import { Starters } from "@/components/CoachStarters";
import {
  ObjectiveAmount,
  ObjectiveBar,
  objectiveStatusText,
  statusColor,
} from "@/components/goals";
import { formatScore, useScore } from "@/components/score";
import { chartParams } from "@/lib/chartModel";
import { useTalk } from "@/lib/talk";
import { formatElapsed, formatVolume } from "@/lib/workouts";
import { useActivity, useRatings } from "@/api/ratings";
import { DayPicker } from "@/components/DayPicker";
import { ChangeDelta, Delta, OverallMove } from "@/components/Delta";
import { FocusCard } from "@/components/FocusCard";
import { OvrBadge } from "@/components/ratings";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Field,
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
  const talk = useTalk();
  const day = useDay(null);
  const ratings = useRatings();
  const me = useMe();
  const prefs = usePreferences();
  const { open } = useLocalSearchParams<{ open?: string }>();
  // "Open the app on: Day log" lands here first, then pushes the log.
  useEffect(() => {
    if (open === "log") {
      router.setParams({ open: "" });
      router.push("/log");
    }
  }, [open]);
  const refresh = () => Promise.all([day.refetch(), ratings.refetch()]);

  if (ratings.data === null) return <NeedsRating />;
  if (day.isPending) return <Loading title={talk.nav.today} />;
  if (day.isError) {
    return (
      <Screen title={talk.nav.today} onRefresh={refresh}>
        <ErrorNote error={day.error} onRetry={refresh} />
      </Screen>
    );
  }
  const d = day.data;
  const t = prefs.today;

  const widgets: Record<TodayWidget, ReactNode> = {
    missed: <MissedRecaps today={d.today} />,
    habits: <HabitsCard day={d} hideDone={t.hideDoneHabits} />,
    rating: ratings.data && <RatingCard nodes={ratings.data.nodes} movers={t.moversShown} />,
    goals: <GoalsCard day={d} limit={t.goalsShown} />,
    journal: <JournalCard day={d} />,
    training: <TrainingCard day={d} />,
    charts: <PinnedCharts today={d.today} />,
    focus: <FocusCard />,
    coach: <CoachCard />,
    recap: d.recap ? (
      <RecapSummary title="Today's recap" recap={d.recap} date={d.date} today={d.today} />
    ) : (
      <YesterdayCard today={d.today} />
    ),
  };
  const shown = t.widgets.filter((w) => {
    const feature = TODAY_WIDGET_FEATURE[w.id];
    return w.visible && (!feature || prefs.features[feature]);
  });

  return (
    <Screen
      eyebrow={`${talk.todayEyebrow ? `${talk.todayEyebrow} · ` : ""}${longDate(d.today)}`}
      title={t.greeting && me.data?.displayName ? greeting(me.data.displayName) : talk.nav.today}
      subtitle={STATUS_LABEL[d.status]}
      onRefresh={refresh}
    >
      <View style={styles.actions}>
        {t.showLogButton && (
          <View style={{ flex: 1 }}>
            <Button
              title={d.status === "open" ? "Log today →" : "Open today's log →"}
              onPress={() => openLog(d.today, d.today)}
            />
          </View>
        )}
        <DayPicker today={d.today} onPick={(date) => openLog(date, d.today)} />
        {prefs.features.coach && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={talk.coach}
            hitSlop={8}
            onPress={() => router.push("/coach")}
            style={styles.iconButton}
          >
            <SymbolView
              name="bubble.left.and.text.bubble.right"
              tintColor={colors.neon}
              size={20}
            />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize Today"
          hitSlop={8}
          onPress={() => router.push({ pathname: "/personalize", params: { tab: "today" } })}
          style={styles.iconButton}
        >
          <SymbolView name="slider.horizontal.3" tintColor={colors.court300} size={20} />
        </Pressable>
      </View>

      {shown.length === 0 ? (
        <Card>
          <Muted style={{ textAlign: "center" }}>Every widget is hidden.</Muted>
          <TextLinkButton
            label="Choose what Today shows"
            onPress={() => router.push({ pathname: "/personalize", params: { tab: "today" } })}
          />
        </Card>
      ) : (
        shown.map((w) => <View key={w.id}>{widgets[w.id]}</View>)
      )}
    </Screen>
  );
}

function greeting(name: string) {
  const hour = new Date().getHours();
  const part =
    hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return `${part}, ${name.split(" ")[0]}`;
}

function TextLinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ alignSelf: "center", marginTop: space.sm }}>
      <Text style={{ color: colors.neon, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function HabitsCard({ day, hideDone }: { day: DayDto; hideDone: boolean }) {
  const scheduled = day.habits.filter((h) => h.scheduled);
  const extra = day.habits.filter(
    (h) => !h.scheduled && (h.entry || h.children?.some((c) => c.entry)),
  );
  const count = scheduled.filter(isDayHabitDone).length;

  return (
    <Section
      title="Habits"
      action={{ label: "Stats →", href: { pathname: "/habits", params: { view: "habits" } } }}
    >
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
            {[...scheduled, ...extra]
              .filter((h) => !hideDone || !isDayHabitDone(h))
              .map((h) => (
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

function RatingCard({ nodes, movers: moverCount }: { nodes: RatedNodeDto[]; movers: number }) {
  const talk = useTalk();
  const { mode } = useScore();
  const root = nodes.find((n) => n.parentId === null);
  if (root?.value == null) return null;
  const parents = new Set(nodes.map((n) => n.parentId));
  const movers = nodes
    .filter((n) => !parents.has(n.id) && n.trend != null && Math.abs(n.trend) >= TREND_THRESHOLD)
    .sort((a, b) => Math.abs(b.trend!) - Math.abs(a.trend!))
    .slice(0, moverCount);

  return (
    <Section
      title={mode === "growth" ? `Your ${talk.growthMode} season` : "Your rating"}
      action={{ label: "Full rating →", href: "/ratings" }}
    >
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
              Projected {formatScore(mode, root.projection)} at season end
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
      {recap.overallBefore !== null && recap.overallAfter !== null && (
        <OverallMove mode={recap.mode} before={recap.overallBefore} after={recap.overallAfter} />
      )}
      <Body>{recap.narrative}</Body>
      {top.map((c) => (
        <Link key={c.nodeId} href={{ pathname: "/node/[id]", params: { id: c.nodeId } }} asChild>
          <Pressable style={styles.change}>
            <ChangeDelta delta={c.delta} growth={c.growth} style={{ width: 52 }} />
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

function GoalsCard({ day, limit }: { day: DayDto; limit: number }) {
  const running = day.objectives
    .filter((o) => o.objective.progress.status === "active")
    .sort((a, b) => a.objective.endsOn.localeCompare(b.objective.endsOn));
  const shown = running.slice(0, limit);
  return (
    <Section
      title="Goals"
      action={{
        label: running.length > shown.length ? `All ${running.length} →` : "All goals →",
        href: { pathname: "/habits", params: { view: "goals" } },
      }}
    >
      {shown.length === 0 ? (
        <Muted>No goals running.</Muted>
      ) : (
        shown.map(({ objective: o }) => (
          <Pressable key={o.id} onPress={() => openLog(day.today, day.today)} style={{ gap: 6 }}>
            <View style={styles.goalHead}>
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {o.name}
              </Body>
              <ObjectiveAmount objective={o} size={14} />
            </View>
            <ObjectiveBar objective={o} thin />
            <Text style={{ color: statusColor(o), fontSize: 12 }}>{objectiveStatusText(o)}</Text>
          </Pressable>
        ))
      )}
    </Section>
  );
}

function TrainingCard({ day }: { day: DayDto }) {
  return (
    <Section
      title="Training"
      action={{
        label: day.workouts.length ? "Train →" : "Start a workout →",
        href: { pathname: "/habits", params: { view: "train" } },
      }}
    >
      {day.workouts.length === 0 ? (
        <Muted>No workouts yet today.</Muted>
      ) : (
        day.workouts.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: w.id } })}
            style={styles.goalHead}
          >
            <Body style={{ flex: 1 }} numberOfLines={1}>
              {w.name}
            </Body>
            <Muted>
              {formatElapsed(w.durationS)}
              {w.volumeKg > 0 && ` · ${formatVolume(w.volumeKg, day.units)}`}
            </Muted>
          </Pressable>
        ))
      )}
    </Section>
  );
}

/** Charts pinned from the explorer. Renders nothing without pins. */
function PinnedCharts({ today }: { today: string }) {
  const views = useChartViews();
  const pinned = views.data?.filter((v) => v.pinned) ?? [];
  if (!pinned.length) return null;
  return (
    <View style={{ gap: space.md }}>
      {pinned.map((v) => (
        <PinnedChart key={v.id} view={v} today={today} />
      ))}
    </View>
  );
}

function PinnedChart({ view, today }: { view: ChartViewDto; today: string }) {
  const me = useMe();
  const from = me.data
    ? rangeStart(view.range, today, seasonForDate(today).startsOn, me.data.createdAt.slice(0, 10))
    : null;
  const series = useMetricSeries(view.metricIds, from);
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/charts",
          params: { ...chartParams(view.metricIds, view), view: view.id },
        })
      }
    >
      <Section title={view.name}>
        {series.data ? (
          <MetricChart
            series={series.data.series}
            config={view}
            weekStart={me.data?.weekStart ?? 1}
            height={170}
            compact
          />
        ) : (
          <Muted style={{ height: 170, textAlign: "center", paddingTop: 70 }}>Loading…</Muted>
        )}
      </Section>
    </Pressable>
  );
}

/** Today's way into the coach: a question box and starter questions. */
function CoachCard() {
  const talk = useTalk();
  const [draft, setDraft] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return;
    setDraft("");
    router.push({ pathname: "/coach", params: { ask: text.trim() } });
  };
  return (
    <Section
      title={`Ask the ${talk.coach.toLowerCase()}`}
      action={{ label: "Open chat →", href: "/coach" }}
    >
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Field
          accessibilityLabel={`Ask the ${talk.coach.toLowerCase()}`}
          value={draft}
          maxLength={MAX_COACH_MESSAGE}
          onChangeText={setDraft}
          onSubmitEditing={() => ask(draft)}
          returnKeyType="send"
          placeholder="What should I work on today?"
          style={{ flex: 1 }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!draft.trim()}
          onPress={() => ask(draft)}
          style={[styles.ask, !draft.trim() && { opacity: 0.4 }]}
        >
          <Text style={styles.askText}>Ask</Text>
        </Pressable>
      </View>
      <Starters onPick={ask} />
    </Section>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  goalHead: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  ask: {
    backgroundColor: colors.neon,
    borderRadius: 10,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  askText: {
    color: colors.court950,
    fontFamily: fonts.display,
    fontSize: 16,
    textTransform: "uppercase",
  },
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
