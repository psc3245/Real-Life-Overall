import { addDays, MAX_GAME_PLAN_LINKS, MAX_GAME_PLAN_NOTE, statPeriod } from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useDay } from "@/api/days";
import { useCreateGamePlan, useGamePlans, useUpdateGamePlan } from "@/api/gamePlans";
import { useRatings } from "@/api/ratings";
import { AttributePicker } from "@/components/AttributePicker";
import { Chip, DateStepper, FormRow } from "@/components/controls";
import { FeatureGate } from "@/components/FeatureGate";
import { Button, ErrorNote, Field, Loading, Screen } from "@/components/ui";
import { useTalk } from "@/lib/talk";
import { space } from "@/lib/theme";

/** End-date shortcuts: Game Plans run for weeks or months, not days. */
function endPresets(today: string, seasonEndsOn: string | undefined) {
  const monthEnd = statPeriod("month", today, 1).end;
  return [
    { label: "End of month", date: monthEnd },
    ...(seasonEndsOn && seasonEndsOn !== monthEnd
      ? [{ label: "End of season", date: seasonEndsOn }]
      : []),
    { label: "6 weeks", date: addDays(today, 41) },
    { label: "3 months", date: addDays(today, 89) },
  ];
}

/** New Game Plan (no id) or edit one, as a sheet over the goals list (DESIGN.md §7.16). */
function GamePlanEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const plans = useGamePlans();
  const ratings = useRatings();
  const today = useDay(null).data?.today;
  if ((id && plans.isPending) || !today) return <Loading />;
  const plan = id ? plans.data?.find((p) => p.id === id) : undefined;
  return (
    <Editor
      key={plan?.id ?? "new"}
      plan={plan}
      today={today}
      nodes={ratings.data?.nodes ?? []}
      seasonEndsOn={ratings.data?.season.endsOn}
    />
  );
}

function Editor({
  plan,
  today,
  nodes,
  seasonEndsOn,
}: {
  plan?: NonNullable<ReturnType<typeof useGamePlans>["data"]>[number];
  today: string;
  nodes: NonNullable<ReturnType<typeof useRatings>["data"]>["nodes"];
  seasonEndsOn?: string;
}) {
  const talk = useTalk();
  const presets = endPresets(today, seasonEndsOn);
  const [name, setName] = useState(plan?.name ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [startsOn, setStartsOn] = useState(plan?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(plan?.endsOn ?? presets[0]!.date);
  const [links, setLinks] = useState<string[]>(plan?.links ?? []);
  const create = useCreateGamePlan();
  const update = useUpdateGamePlan();
  const saving = create.isPending || update.isPending;
  const validWindow = endsOn >= startsOn;

  const toggleLink = (nodeId: string) =>
    setLinks((prev) =>
      prev.includes(nodeId)
        ? prev.filter((x) => x !== nodeId)
        : prev.length < MAX_GAME_PLAN_LINKS
          ? [...prev, nodeId]
          : prev,
    );
  const submit = () => {
    const body = { name: name.trim(), note: note.trim(), startsOn, endsOn, links };
    const done = { onSuccess: () => router.back() };
    if (plan) update.mutate({ id: plan.id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: plan ? `Edit ${talk.gamePlan}` : `New ${talk.gamePlan}` }} />
      <FormRow label={talk.gamePlan}>
        <Field
          value={name}
          maxLength={80}
          autoFocus={!plan}
          placeholder="e.g. Build strength"
          onChangeText={setName}
        />
      </FormRow>
      <FormRow label="What it looks like (optional)">
        <Field
          value={note}
          maxLength={MAX_GAME_PLAN_NOTE}
          multiline
          placeholder="e.g. Lifting comes first; cardio can slide a bit."
          onChangeText={setNote}
        />
      </FormRow>
      <FormRow label="Starts">
        <DateStepper label="Starts on" value={startsOn} onChange={setStartsOn} today={today} />
      </FormRow>
      <FormRow label="Through">
        <DateStepper
          label="Through"
          value={endsOn}
          onChange={setEndsOn}
          min={startsOn}
          today={today}
        />
        <View style={styles.wrap}>
          {presets.map((p) => (
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
        <FormRow label={`Leans into (${links.length}/${MAX_GAME_PLAN_LINKS})`}>
          <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
        </FormRow>
      )}
      <ErrorNote error={create.error ?? update.error} />
      <Button
        title={saving ? "Saving…" : plan ? "Save" : `Add ${talk.gamePlan.toLowerCase()}`}
        disabled={!name.trim() || !validWindow || saving}
        onPress={submit}
      />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});

export default function GatedGamePlanEditScreen() {
  return (
    <FeatureGate feature="goals">
      <GamePlanEditScreen />
    </FeatureGate>
  );
}
