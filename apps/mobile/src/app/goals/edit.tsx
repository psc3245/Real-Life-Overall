import {
  addDays,
  habitObjectiveUnit,
  KIND_SOURCES,
  MAX_HABIT_LINKS,
  OBJECTIVE_KIND_HINTS,
  OBJECTIVE_KIND_LABELS,
  OBJECTIVE_KINDS,
  OBJECTIVE_SOURCE_LABELS,
  OBJECTIVE_TERM_LABELS,
  objectiveTerm,
  statPeriod,
  weightUnit,
  type MeDto,
  type ObjectiveDto,
  type ObjectiveKind,
  type ObjectiveSource,
} from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
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
import { useCoachDraft, useResolveCoachSuggestion } from "@/api/coach";
import { FeatureGate } from "@/components/FeatureGate";

const SOURCE_DETAIL: Record<ObjectiveSource, string> = {
  manual: "Add what you did toward it on each day's log.",
  habit:
    "Every entry of the habit inside the goal's dates counts: amounts for counts and time, otherwise days done.",
  workouts: "Every workout you finish inside the goal's dates counts as one.",
  weight: "The weight you log each day is the reading; the latest one counts.",
};
const REACH_MANUAL_DETAIL = "Log where you are on any day; the latest reading counts.";

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

/**
 * New goal (no id), edit one, or review one the coach drafted (`?thread=&message=&index=`,
 * saved through the coach), as a sheet over the goals list.
 */
function GoalEditScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    thread?: string;
    message?: string;
    index?: string;
  }>();
  const { id } = params;
  const objectives = useObjectives();
  const habits = useHabits();
  const me = useMe();
  const today = useDay(null).data?.today;
  const coachDraft = useCoachDraft(params.thread, params.message, Number(params.index));
  if ((id && objectives.isPending) || habits.isPending || !me.data || !today) return <Loading />;
  if (params.message) {
    if (coachDraft.isPending) return <Loading />;
    const d = coachDraft.draft;
    if (d?.kind !== "goal" || d.status !== "pending") {
      return (
        <Screen>
          <Muted>This draft was already saved or discarded.</Muted>
        </Screen>
      );
    }
    return (
      <Editor
        habits={habits.data ?? []}
        today={today}
        me={me.data}
        draft={{
          messageId: params.message,
          index: d.index,
          name: d.name,
          kind: d.goalKind ?? "total",
          target: d.target,
          unit: d.unit,
          startValue: d.startValue ?? null,
          endsOn: d.endsOn ?? addDays(today, d.durationDays - 1),
          links: d.nodeIds,
        }}
      />
    );
  }
  const objective = id ? objectives.data?.find((o) => o.id === id) : undefined;
  if (id && !objective) {
    return (
      <Screen>
        <Muted>That goal is gone.</Muted>
      </Screen>
    );
  }
  return <Editor objective={objective} habits={habits.data ?? []} today={today} me={me.data} />;
}

function Editor({
  objective,
  habits,
  today,
  me,
  draft,
}: {
  objective?: ObjectiveDto;
  habits: NonNullable<ReturnType<typeof useHabits>["data"]>;
  today: string;
  me: MeDto;
  /** A coach draft to review (a manual goal): saved through the coach. */
  draft?: Pick<
    ObjectiveDto,
    "name" | "kind" | "target" | "unit" | "startValue" | "endsOn" | "links"
  > & { messageId: string; index: number };
}) {
  const { weekStart, trackWeight } = me;
  const nodes = useRatings().data?.nodes ?? [];
  const start = objective ?? draft;
  const [name, setName] = useState(start?.name ?? "");
  const [kind, setKind] = useState<ObjectiveKind>(start?.kind ?? "total");
  const [source, setSource] = useState<ObjectiveSource>(objective?.source ?? "manual");
  const [startValue, setStartValue] = useState<number | null>(start?.startValue ?? null);
  const [habitId, setHabitId] = useState(objective?.habitId ?? "");
  const [target, setTarget] = useState<number | null>(start?.target ?? null);
  const [unit, setUnit] = useState(start?.unit ?? "");
  const [startsOn, setStartsOn] = useState(objective?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(start?.endsOn ?? statPeriod("week", today, weekStart).end);
  const [links, setLinks] = useState<string[]>(start?.links ?? []);
  const create = useCreateObjective();
  const update = useUpdateObjective();
  const accept = useResolveCoachSuggestion();
  const saving = create.isPending || update.isPending || accept.isPending;

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
        : source === "weight"
          ? weightUnit(me.unitSystem)
          : unit;
  const validWindow = Boolean(startsOn && endsOn && endsOn >= startsOn);
  const reach = kind === "reach";
  // Weight goals may leave the start blank to begin from the latest logged weight.
  const validNumbers = reach
    ? target !== null && (startValue !== null ? startValue !== target : source === "weight")
    : Boolean(target);
  const pickKind = (k: ObjectiveKind) => {
    setKind(k);
    if (!KIND_SOURCES[k].includes(source)) setSource(KIND_SOURCES[k][0]!);
  };

  const toggleLink = (nodeId: string) =>
    setLinks((prev) =>
      prev.includes(nodeId)
        ? prev.filter((x) => x !== nodeId)
        : prev.length < MAX_HABIT_LINKS
          ? [...prev, nodeId]
          : prev,
    );

  const submit = () => {
    if (target === null || !validNumbers) return;
    const body = {
      name: name.trim(),
      target,
      unit: unit.trim(),
      startsOn,
      endsOn,
      links,
      ...(reach && startValue !== null && { startValue }),
    };
    const done = { onSuccess: () => router.back() };
    if (draft) {
      accept.mutate(
        {
          messageId: draft.messageId,
          index: draft.index,
          action: "accept",
          edits: { ...body, kind, source: "manual" },
        },
        done,
      );
    } else if (objective) update.mutate({ id: objective.id, ...body }, done);
    else create.mutate({ ...body, kind, source, ...(source === "habit" && { habitId }) }, done);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: objective ? "Edit goal" : "New goal" }} />
      <FormRow label="Goal">
        <Field
          value={name}
          maxLength={80}
          autoFocus={!objective}
          placeholder="e.g. Run 100 miles before New Year's"
          onChangeText={setName}
        />
      </FormRow>

      <FormRow label="Kind of goal">
        <View style={styles.wrap}>
          {OBJECTIVE_KINDS.map((k) => (
            <Chip
              key={k}
              label={OBJECTIVE_KIND_LABELS[k]}
              selected={kind === k}
              disabled={Boolean(objective)}
              onPress={() => pickKind(k)}
            />
          ))}
        </View>
        <Muted style={{ fontSize: 13 }}>{OBJECTIVE_KIND_HINTS[kind]}</Muted>
      </FormRow>

      <FormRow label="How progress is counted">
        <View style={styles.wrap}>
          {KIND_SOURCES[kind].map((s) => (
            <Chip
              key={s}
              label={OBJECTIVE_SOURCE_LABELS[s]}
              selected={source === s}
              disabled={
                Boolean(objective) ||
                (s === "habit" && countable.length === 0) ||
                (s === "weight" && !trackWeight)
              }
              onPress={() => setSource(s)}
            />
          ))}
        </View>
        <Muted style={{ fontSize: 13 }}>
          {reach && source === "manual" ? REACH_MANUAL_DETAIL : SOURCE_DETAIL[source]}
          {reach && !trackWeight && " Turn on weight tracking in settings to follow your weight."}
        </Muted>
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
        {reach && (
          <FormRow label={source === "weight" ? "Start (blank: latest)" : "Starting at"}>
            <NumberField
              label="Starting at"
              value={startValue}
              onChange={setStartValue}
              width={110}
            />
          </FormRow>
        )}
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

      <ErrorNote error={accept.error ?? create.error ?? update.error} />
      <Button
        title={saving ? "Saving…" : objective ? "Save goal" : "Add goal"}
        disabled={
          !name.trim() ||
          !validNumbers ||
          !validWindow ||
          (source === "habit" && !habitId) ||
          saving
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
