import {
  addDays,
  habitObjectiveUnit,
  MAX_HABIT_LINKS,
  OBJECTIVE_SOURCE_LABELS,
  OBJECTIVE_SOURCES,
  OBJECTIVE_TERM_LABELS,
  objectiveTerm,
  statPeriod,
  type ObjectiveDto,
  type ObjectiveSource,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useDay, useHabits } from "@/api/days";
import { useMe } from "@/api/hooks";
import { useCreateObjective, useObjectives, useUpdateObjective } from "@/api/objectives";
import { useRatings } from "@/api/ratings";
import { AttributePicker } from "@/components/AttributePicker";
import { Chip, DateStepper, FormRow, NumberField } from "@/components/controls";
import { Button, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

const SOURCE_DETAIL: Record<ObjectiveSource, string> = {
  manual: "Add what you did toward it on each day's log.",
  habit:
    "Every entry of the habit inside the goal's dates counts: amounts for counts and time, otherwise days done.",
  workouts: "Every workout you finish inside the goal's dates counts as one.",
};

/** Quick deadlines; the steppers cover everything else. */
function deadlinePresets(today: string, weekStart: number) {
  const year = today.slice(0, 4);
  return [
    { label: "End of week", date: statPeriod("week", today, weekStart).end },
    { label: "End of month", date: statPeriod("month", today, weekStart).end },
    { label: "In 90 days", date: addDays(today, 89) },
    { label: "New Year's", date: `${year}-12-31` },
  ];
}

/** New goal (no id) or edit one, as a sheet over the goals list. */
function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const objectives = useObjectives();
  const habits = useHabits();
  const me = useMe();
  const today = useDay(null).data?.today;
  if ((id && objectives.isPending) || habits.isPending || !me.data || !today) return <Loading />;
  const objective = id ? objectives.data?.find((o) => o.id === id) : undefined;
  if (id && !objective) {
    return (
      <Screen>
        <Muted>That goal is gone.</Muted>
      </Screen>
    );
  }
  return (
    <Editor
      objective={objective}
      habits={habits.data ?? []}
      today={today}
      weekStart={me.data.weekStart}
    />
  );
}

function Editor({
  objective,
  habits,
  today,
  weekStart,
}: {
  objective?: ObjectiveDto;
  habits: NonNullable<ReturnType<typeof useHabits>["data"]>;
  today: string;
  weekStart: number;
}) {
  const nodes = useRatings().data?.nodes ?? [];
  const [name, setName] = useState(objective?.name ?? "");
  const [source, setSource] = useState<ObjectiveSource>(objective?.source ?? "manual");
  const [habitId, setHabitId] = useState(objective?.habitId ?? "");
  const [target, setTarget] = useState<number | null>(objective?.target ?? null);
  const [unit, setUnit] = useState(objective?.unit ?? "");
  const [startsOn, setStartsOn] = useState(objective?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(
    objective?.endsOn ?? statPeriod("week", today, weekStart).end,
  );
  const [links, setLinks] = useState<string[]>(objective?.links ?? []);
  const create = useCreateObjective();
  const update = useUpdateObjective();
  const saving = create.isPending || update.isPending;

  // Habits that can be counted: anything but groups (their sub-habits count instead).
  const countable = habits.filter((h) => h.type !== "group");
  const habit = countable.find((h) => h.id === habitId);
  const shownUnit =
    source === "habit"
      ? habit
        ? habitObjectiveUnit(habit.type, habit.config)
        : ""
      : source === "workouts"
        ? "workouts"
        : unit;
  const validWindow = Boolean(startsOn && endsOn && endsOn >= startsOn);

  const toggleLink = (nodeId: string) =>
    setLinks((prev) =>
      prev.includes(nodeId)
        ? prev.filter((x) => x !== nodeId)
        : prev.length < MAX_HABIT_LINKS
          ? [...prev, nodeId]
          : prev,
    );

  const submit = () => {
    if (!target) return;
    const body = { name: name.trim(), target, unit: unit.trim(), startsOn, endsOn, links };
    const done = { onSuccess: () => router.back() };
    if (objective) update.mutate({ id: objective.id, ...body }, done);
    else create.mutate({ ...body, source, ...(source === "habit" && { habitId }) }, done);
  };

  return (
    <Screen eyebrow={objective ? "Edit goal" : "New goal"}>
      <FormRow label="Goal">
        <Field
          value={name}
          maxLength={80}
          autoFocus={!objective}
          placeholder="e.g. Run 100 miles before New Year's"
          onChangeText={setName}
        />
      </FormRow>

      <FormRow label="How progress is counted">
        <View style={styles.wrap}>
          {OBJECTIVE_SOURCES.map((s) => (
            <Chip
              key={s}
              label={OBJECTIVE_SOURCE_LABELS[s]}
              selected={source === s}
              disabled={Boolean(objective) || (s === "habit" && countable.length === 0)}
              onPress={() => setSource(s)}
            />
          ))}
        </View>
        <Muted style={{ fontSize: 13 }}>{SOURCE_DETAIL[source]}</Muted>
      </FormRow>
      {source === "habit" && (
        <FormRow label="Habit to count">
          <View style={styles.wrap}>
            {countable.map((h) => (
              <Chip
                key={h.id}
                label={h.name}
                selected={habitId === h.id}
                disabled={Boolean(objective)}
                onPress={() => setHabitId(h.id)}
              />
            ))}
          </View>
        </FormRow>
      )}

      <View style={{ flexDirection: "row", gap: space.lg }}>
        <FormRow label="Target">
          <NumberField label="Target" value={target} onChange={setTarget} width={110} />
        </FormRow>
        <View style={{ flex: 1 }}>
          <FormRow label="Unit">
            <Field
              accessibilityLabel="Unit"
              value={shownUnit}
              maxLength={20}
              editable={source === "manual"}
              placeholder="miles, sessions, books…"
              onChangeText={setUnit}
              style={source !== "manual" && { opacity: 0.6 }}
            />
          </FormRow>
        </View>
      </View>

      <FormRow label="Starts">
        <DateStepper label="Starts on" value={startsOn} onChange={setStartsOn} today={today} />
      </FormRow>
      <FormRow
        label={`Deadline${validWindow ? ` · ${OBJECTIVE_TERM_LABELS[objectiveTerm(startsOn, endsOn)]}` : ""}`}
      >
        <DateStepper
          label="Deadline"
          value={endsOn}
          onChange={setEndsOn}
          min={startsOn}
          today={today}
        />
        <View style={styles.wrap}>
          {deadlinePresets(today, weekStart).map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              selected={endsOn === p.date}
              onPress={() => setEndsOn(p.date)}
            />
          ))}
        </View>
      </FormRow>

      {nodes.length > 0 && (
        <FormRow label={`Builds these attributes (${links.length}/${MAX_HABIT_LINKS})`}>
          <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
        </FormRow>
      )}

      <ErrorNote error={create.error ?? update.error} />
      <Button
        title={saving ? "Saving…" : objective ? "Save goal" : "Add goal"}
        disabled={
          !name.trim() || !target || !validWindow || (source === "habit" && !habitId) || saving
        }
        onPress={submit}
      />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});

export default function GatedGoalEditScreen() {
  return (
    <FeatureGate feature="goals">
      <GoalEditScreen />
    </FeatureGate>
  );
}
