import {
  addDays,
  BACKFILL_DAYS,
  groupProgress,
  isDayHabitDone,
  isHabitDone,
  MAX_DAY_JOURNAL,
  type DayDto,
  type DayHabitDto,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from "react-native";
import { useDay, useSaveEntry, useSaveJournal } from "@/api/days";
import { useRatings } from "@/api/ratings";
import { DayPicker } from "@/components/DayPicker";
import { GuidedPrompts } from "@/components/GuidedPrompts";
import { HabitEntryInput } from "@/components/HabitEntryInput";
import { NodeChip } from "@/components/NodeChip";
import { RecapPanel } from "@/components/RecapPanel";
import {
  Body,
  Card,
  ErrorNote,
  Field,
  Label,
  Loading,
  Muted,
  NeedsRating,
  Screen,
  TextLink,
} from "@/components/ui";
import { weekdayDate } from "@/lib/format";
import { colors, space } from "@/lib/theme";

function dayTitle(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return weekdayDate(date);
}

/** Logging one day: guided prompts, journal, habits and the recap. `?date=` picks a past day. */
export default function LogScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day = useDay(date ?? null);
  const ratings = useRatings();

  if (ratings.data === null) return <NeedsRating />;
  if (day.isPending) return <Loading />;
  if (day.isError) {
    return (
      <Screen>
        <ErrorNote error={day.error} onRetry={() => void day.refetch()} />
      </Screen>
    );
  }

  const d = day.data;
  const go = (target: string) => router.setParams({ date: target === d.today ? "" : target });
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={100}>
      <Screen
        eyebrow="Day log"
        title={dayTitle(d.date, d.today)}
        onRefresh={() => void day.refetch()}
        refreshing={day.isRefetching}
      >
        <View style={styles.nav}>
          <DayPicker today={d.today} selected={d.date} onPick={go} />
          <NavButton
            symbol="chevron.left"
            label="Previous day"
            onPress={() => go(addDays(d.date, -1))}
          />
          <NavButton
            symbol="chevron.right"
            label="Next day"
            disabled={d.date >= d.today}
            onPress={() => go(addDays(d.date, 1))}
          />
        </View>
        {!d.editable && (
          <Card>
            <Muted>
              This day is past the {BACKFILL_DAYS}-day backfill window, so it&apos;s read-only.
            </Muted>
          </Card>
        )}
        <GuidedPrompts key={`prompts-${d.date}-${d.prompts.length}`} day={d} />
        <Journal key={d.date} day={d} />
        <Habits day={d} names={names} />
        <RecapPanel day={d} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function NavButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: "chevron.left" | "chevron.right";
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={[styles.navButton, disabled && { opacity: 0.3 }]}
    >
      <SymbolView name={symbol} tintColor={colors.court100} size={18} />
    </Pressable>
  );
}

function Journal({ day }: { day: DayDto }) {
  const save = useSaveJournal(day.date);
  const [text, setText] = useState(day.journal);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(value, { onSuccess: () => setDirty(false) }), 800);
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Label>Journal</Label>
        <Label style={{ color: colors.court500 }}>
          {save.isError ? "Not saved" : dirty ? "Saving…" : text ? "Saved" : ""}
        </Label>
      </View>
      <Field
        value={text}
        multiline
        maxLength={MAX_DAY_JOURNAL}
        editable={day.editable}
        onChangeText={onChange}
        placeholder="How did the day go? What did you work on, what got in the way, what went well?"
      />
      <ErrorNote error={save.error} />
    </View>
  );
}

function Habits({ day, names }: { day: DayDto; names: Map<string, string> }) {
  const scheduled = day.habits.filter((h) => h.scheduled);
  const bonus = day.habits.filter((h) => !h.scheduled);
  const done = scheduled.filter(isDayHabitDone);

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.head}>
        <Label>Habits{scheduled.length > 0 ? ` ${done.length}/${scheduled.length}` : ""}</Label>
        <TextLink href="/habits/manage">Manage habits →</TextLink>
      </View>
      {day.habits.length === 0 && (
        <Card>
          <Muted>No habits yet. Add one to log alongside your journal.</Muted>
        </Card>
      )}
      {scheduled.map((h) => (
        <HabitItem key={`${day.date}-${h.habit.id}`} item={h} day={day} names={names} />
      ))}
      {bonus.length > 0 && (
        <>
          <Label style={{ color: colors.court500 }}>Not scheduled today</Label>
          <View style={{ gap: space.md, opacity: 0.8 }}>
            {bonus.map((h) => (
              <HabitItem key={`${day.date}-${h.habit.id}`} item={h} day={day} names={names} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** A habit card, or a group with its sub-habits indented below. */
function HabitItem(props: { item: DayHabitDto; day: DayDto; names: Map<string, string> }) {
  const { item } = props;
  if (item.habit.type !== "group") return <HabitCard {...props} />;
  const done = isDayHabitDone(item);
  return (
    <Card style={[styles.group, done && styles.done]}>
      <View style={styles.head}>
        <Body style={{ fontWeight: "600" }}>
          {item.habit.name}
          {done && <Text style={{ color: colors.neon }}> ✓ done</Text>}
        </Body>
        <Muted>{groupProgress(item)}</Muted>
      </View>
      <View style={styles.children}>
        {(item.children ?? []).map((c) => (
          <HabitCard key={c.habit.id} {...props} item={c} nested />
        ))}
      </View>
    </Card>
  );
}

function HabitCard({
  item,
  day,
  names,
  nested,
}: {
  item: DayHabitDto;
  day: DayDto;
  names: Map<string, string>;
  nested?: boolean;
}) {
  const save = useSaveEntry(day.date, item.habit.id);
  const { habit, entry } = item;
  const done = entry ? isHabitDone(habit.type, habit.config, entry) : false;
  const body = (
    <View style={{ gap: space.sm }}>
      <Body style={{ fontWeight: "600" }}>{habit.name}</Body>
      {habit.links.length > 0 && (
        <View style={styles.chips}>
          {habit.links.map((id) => (
            <NodeChip key={id} id={id} name={names.get(id)} />
          ))}
        </View>
      )}
      <HabitEntryInput
        habit={habit}
        entry={entry}
        disabled={!day.editable}
        onSave={(value) => save.mutate(value)}
      />
      <ErrorNote error={save.error} />
    </View>
  );
  if (nested) return body;
  return <Card style={done ? styles.done : undefined}>{body}</Card>;
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", gap: space.sm },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.md,
  },
  group: { gap: space.md },
  done: { borderColor: "rgba(60,242,200,0.5)" },
  children: {
    gap: space.lg,
    borderLeftWidth: 1,
    borderLeftColor: colors.court700,
    paddingLeft: space.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
