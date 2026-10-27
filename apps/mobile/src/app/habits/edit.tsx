import {
  addDays,
  ALL_DAYS,
  GROUP_RULE_LABELS,
  GROUP_RULES,
  HABIT_DIRECTIONS,
  HABIT_TYPE_LABELS,
  HABIT_TYPES,
  MAX_HABIT_LINKS,
  normalizeHabitConfig,
  type HabitConfig,
  type HabitDirection,
  type HabitDto,
  type HabitType,
  type RatedNodeDto,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
} from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useCreateHabit, useDay, useHabits, useSuggestLinks, useUpdateHabit } from "@/api/days";
import { useRatings } from "@/api/ratings";
import { AttributePicker } from "@/components/AttributePicker";
import { Chip, FormRow, NumberField } from "@/components/controls";
import { Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/** What "kept" means for an avoid habit, by how it's logged. */
const AVOID_HELP: Partial<Record<HabitType, string>> = {
  checkbox: 'Every day counts as kept until you mark a slip. Mark "Avoided" to report a clean day.',
  checknote: "Every day counts as kept until you mark a slip; add a note about what happened.",
  counter: "Log how many. Staying at or under the limit keeps the day; a limit of 0 means none.",
  duration: "Log the minutes. Staying at or under the limit keeps the day.",
  slider: "Log the level. At or below your line keeps the day.",
  rating: "Log the stars. At or below your line keeps the day.",
  shorttext: "Write down slips only. A day with nothing written counts as kept.",
  journal: "Write down slips only. A day with nothing written counts as kept.",
};

/** New habit, new sub-habit (`?parent=`) or edit (`?id=`), as a modal. */
function EditHabitScreen() {
  const { id, parent: parentId } = useLocalSearchParams<{ id?: string; parent?: string }>();
  const habits = useHabits();
  const ratings = useRatings();
  const today = useDay(null).data?.today;

  if (habits.isPending || ratings.isPending || !today) return <Loading />;
  const habit = id ? habits.data?.find((h) => h.id === id) : undefined;
  const parentKey = habit?.parentId ?? parentId;
  const parent = parentKey ? habits.data?.find((h) => h.id === parentKey) : undefined;

  return (
    <>
      <Stack.Screen
        options={{ title: habit ? "Edit habit" : parent ? "New sub-habit" : "New habit" }}
      />
      <HabitEditor
        habit={habit}
        parent={parent}
        nodes={ratings.data?.nodes ?? []}
        today={today}
        onDone={() => router.back()}
      />
    </>
  );
}

function HabitEditor({
  habit,
  parent,
  nodes,
  today,
  onDone,
}: {
  habit?: HabitDto;
  parent?: HabitDto;
  nodes: RatedNodeDto[];
  today: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [type, setType] = useState<HabitType>(habit?.type ?? "checkbox");
  const [config, setConfig] = useState<HabitConfig>(
    habit?.config ?? normalizeHabitConfig("checkbox"),
  );
  const [days, setDays] = useState<number[]>(habit?.days ?? ALL_DAYS);
  const [links, setLinks] = useState<string[]>(habit?.links ?? []);
  const [startsOn, setStartsOn] = useState(habit?.startsOn ?? today);
  const [reason, setReason] = useState<string | null>(null);
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const suggest = useSuggestLinks();
  const saving = create.isPending || update.isPending;

  const avoid = config.direction === "avoid";
  const changeType = (next: HabitType) => {
    setType(next);
    setConfig(normalizeHabitConfig(next, { direction: config.direction }));
  };
  const changeDirection = (direction: HabitDirection) =>
    setConfig(normalizeHabitConfig(type, { ...config, direction, target: null }));
  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  const toggleLink = (nodeId: string) =>
    setLinks((prev) =>
      prev.includes(nodeId)
        ? prev.filter((x) => x !== nodeId)
        : prev.length < MAX_HABIT_LINKS
          ? [...prev, nodeId]
          : prev,
    );
  const runSuggest = () =>
    suggest.mutate(
      { name: name.trim(), type },
      {
        onSuccess: (s) => {
          setLinks(s.nodeIds.slice(0, MAX_HABIT_LINKS));
          setReason(s.reason);
        },
      },
    );

  const submit = () => {
    const body = {
      name: name.trim(),
      config,
      ...(!parent && { days, startsOn }),
      links: type === "group" ? [] : links,
    };
    if (habit) update.mutate({ id: habit.id, ...body }, { onSuccess: onDone });
    else {
      create.mutate(
        { days, startsOn, ...body, type, ...(parent && { parentId: parent.id }) },
        { onSuccess: onDone },
      );
    }
  };

  const num = (key: keyof HabitConfig, label: string) => (
    <FormRow label={label}>
      <NumberField
        label={label}
        value={(config[key] as number | null) ?? null}
        onChange={(v) => setConfig((c) => ({ ...c, [key]: v }))}
      />
    </FormRow>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={100}>
      <Screen>
        {type !== "group" && (
          <FormRow label="Goal">
            <View style={styles.wrap}>
              {HABIT_DIRECTIONS.map((d) => (
                <Chip
                  key={d}
                  label={d === "build" ? "Build: do it" : "Avoid: don't do it"}
                  selected={(config.direction ?? "build") === d}
                  disabled={Boolean(habit)}
                  onPress={() => changeDirection(d)}
                />
              ))}
            </View>
            {avoid && (
              <Muted style={{ fontSize: 13 }}>{AVOID_HELP[type] ?? AVOID_HELP.checkbox}</Muted>
            )}
          </FormRow>
        )}
        <FormRow label="Name">
          <Field
            value={name}
            maxLength={60}
            autoFocus={!habit}
            placeholder={
              parent
                ? `e.g. Stretch (in ${parent.name})`
                : avoid
                  ? "e.g. No smoking, Coffee, Social media"
                  : "e.g. Morning run"
            }
            onChangeText={setName}
          />
        </FormRow>

        <FormRow label="How you log it">
          {habit ? (
            <Muted>{HABIT_TYPE_LABELS[type]} (fixed once created)</Muted>
          ) : (
            <View style={styles.wrap}>
              {HABIT_TYPES.filter((t) => !parent || t !== "group").map((t) => (
                <Chip
                  key={t}
                  label={HABIT_TYPE_LABELS[t]}
                  selected={type === t}
                  onPress={() => changeType(t)}
                />
              ))}
            </View>
          )}
        </FormRow>

        {(type === "counter" || type === "duration" || type === "slider" || type === "rating") && (
          <View style={styles.inline}>
            {type === "counter" && (
              <>
                {num("target", avoid ? "Daily limit (at most)" : "Daily goal")}
                <FormRow label="Unit">
                  <Field
                    value={config.unit ?? ""}
                    maxLength={20}
                    placeholder="pages"
                    onChangeText={(unit) => setConfig((c) => ({ ...c, unit }))}
                    style={{ width: 120 }}
                  />
                </FormRow>
              </>
            )}
            {type === "duration" && num("target", avoid ? "Daily limit (min)" : "Daily goal (min)")}
            {type === "slider" && (
              <>
                {num("min", "From")}
                {num("max", "To")}
              </>
            )}
            {type === "rating" && num("max", "Stars (3–10)")}
            {avoid && (type === "slider" || type === "rating") && num("target", "Stay at or below")}
          </View>
        )}

        {type === "group" && (
          <View style={{ gap: space.sm }}>
            <FormRow label="Done when">
              <View style={styles.wrap}>
                {GROUP_RULES.map((r) => (
                  <Chip
                    key={r}
                    label={GROUP_RULE_LABELS[r]}
                    selected={(config.rule ?? "all") === r}
                    onPress={() => setConfig(normalizeHabitConfig("group", { ...config, rule: r }))}
                  />
                ))}
              </View>
            </FormRow>
            {config.rule === "count" && num("target", "N")}
            <Muted>
              Add sub-habits after saving. They follow this schedule; link attributes on them.
            </Muted>
          </View>
        )}

        {parent ? (
          <Muted>
            Part of <Text style={{ color: colors.court100 }}>{parent.name}</Text>, so it follows
            that group&apos;s schedule.
          </Muted>
        ) : (
          <>
            <FormRow label="Scheduled on">
              <View style={styles.wrap}>
                {WEEKDAY_LETTERS.map((letter, d) => (
                  <View key={d} accessible accessibilityLabel={WEEKDAY_NAMES[d]}>
                    <Chip
                      round
                      label={letter}
                      selected={days.includes(d)}
                      onPress={() => toggleDay(d)}
                    />
                  </View>
                ))}
              </View>
            </FormRow>
            <FormRow label="Starts on">
              <View style={styles.inline}>
                <Button
                  title="−1 day"
                  variant="ghost"
                  onPress={() => setStartsOn(addDays(startsOn, -1))}
                />
                <Text style={styles.date}>{startsOn === today ? "Today" : dayLabel(startsOn)}</Text>
                <Button
                  title="+1 day"
                  variant="ghost"
                  onPress={() => setStartsOn(addDays(startsOn, 1))}
                />
              </View>
            </FormRow>
            {startsOn < today && (
              <Muted>
                Backdated: you can log it on past days, within the 3-day backfill window.
              </Muted>
            )}
          </>
        )}

        {type !== "group" && (
          <Card style={{ gap: space.md }}>
            <View style={styles.linksHead}>
              <Text style={styles.linksTitle}>
                Builds these attributes ({links.length}/{MAX_HABIT_LINKS})
              </Text>
              <Button
                title={suggest.isPending ? "Thinking…" : "✦ Suggest"}
                variant="ghost"
                disabled={!name.trim() || suggest.isPending}
                onPress={runSuggest}
              />
            </View>
            {reason && <Muted style={styles.reason}>{reason}</Muted>}
            <ErrorNote error={suggest.error} />
            <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
          </Card>
        )}

        <ErrorNote error={create.error ?? update.error} />
        <Button
          title={
            saving
              ? "Saving…"
              : habit
                ? "Save habit"
                : parent
                  ? "Add sub-habit"
                  : type === "group"
                    ? "Add group"
                    : "Add habit"
          }
          disabled={!name.trim() || days.length === 0 || saving}
          onPress={submit}
        />
        <Button title="Cancel" variant="ghost" onPress={onDone} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  inline: { flexDirection: "row", flexWrap: "wrap", gap: space.md, alignItems: "center" },
  date: { color: colors.court100, fontSize: 16, minWidth: 100, textAlign: "center" },
  linksHead: { gap: space.sm },
  linksTitle: {
    color: colors.court300,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  reason: { borderLeftWidth: 2, borderLeftColor: colors.neonDim, paddingLeft: space.md },
});

export default function GatedEditHabitScreen() {
  return (
    <FeatureGate feature="habits">
      <EditHabitScreen />
    </FeatureGate>
  );
}
