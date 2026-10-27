import type { DayDto, DayObjectiveDto } from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSaveObjectiveEntry } from "@/api/objectives";
import { useSaveBody } from "@/api/workouts";
import { formatNumber } from "@/lib/format";
import { colors, space, tierColor } from "@/lib/theme";
import { formatElapsed, formatVolume } from "@/lib/workouts";
import { HeightInput, WeightInput } from "./body/BodyInputs";
import { ObjectiveAmount, ObjectiveBar, objectiveStatusText, statusColor } from "./goals";
import { Body, Card, ErrorNote, Field, Label, Muted, TextLink } from "./ui";

const goGoals = () => router.push({ pathname: "/habits", params: { view: "goals" } });
const goTrain = () => router.push({ pathname: "/habits", params: { view: "train" } });

function Head({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.head}>
      <Label>{title}</Label>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={6}>
          <Text style={styles.link}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The day's goals: log what you did toward manual ones; habit goals follow their habit. */
export function DayGoals({ day }: { day: DayDto }) {
  return (
    <View style={{ gap: space.md }}>
      <Head title="Goals" action={{ label: "All goals →", onPress: goGoals }} />
      {day.objectives.length === 0 ? (
        <Card>
          <Muted>
            No goals running on this day. Set one, like &quot;Run 100 miles before New
            Year&apos;s&quot;.
          </Muted>
        </Card>
      ) : (
        day.objectives.map((item) => (
          <DayGoalRow key={`${day.date}-${item.objective.id}`} item={item} day={day} />
        ))
      )}
    </View>
  );
}

function DayGoalRow({ item, day }: { item: DayObjectiveDto; day: DayDto }) {
  const { objective: o } = item;
  const save = useSaveObjectiveEntry(day.date, o.id);
  const [value, setValue] = useState(item.logged === null ? "" : String(item.logged));
  const commit = () => {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    if (n === item.logged || (n === 0 && item.logged === null)) return;
    save.mutate(n);
  };

  return (
    <Card style={[{ gap: space.sm }, item.dayAmount > 0 && { borderColor: colors.neonDim }]}>
      <Body style={{ fontWeight: "600" }}>{o.name}</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <ObjectiveAmount objective={o} />
        <Text style={{ color: statusColor(o), fontSize: 14 }}>{objectiveStatusText(o)}</Text>
      </View>
      {o.source === "manual" ? (
        <View style={styles.row}>
          <Text style={styles.unit}>+</Text>
          <Field
            accessibilityLabel={`${o.name} on this day`}
            keyboardType="decimal-pad"
            returnKeyType="done"
            value={value}
            editable={day.editable}
            placeholder="0"
            onChangeText={setValue}
            onEndEditing={commit}
            style={styles.amount}
          />
          <Text style={styles.unit}>{o.unit}</Text>
          {day.editable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add 1 ${o.unit}`}
              onPress={() => {
                const next = (Number(value) || 0) + 1;
                setValue(String(next));
                save.mutate(next);
              }}
              style={styles.plus}
            >
              <Text style={{ color: colors.court100, fontSize: 15 }}>+1</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Muted>
          {o.source === "workouts"
            ? item.dayAmount > 0
              ? `+${formatNumber(item.dayAmount)} from workouts`
              : "Counts finished workouts"
            : item.dayAmount > 0
              ? `+${formatNumber(item.dayAmount)} from ${o.habitName ?? "the habit"}`
              : `Counts ${o.habitName ?? "a habit"}`}
        </Muted>
      )}
      <ObjectiveBar objective={o} thin />
      <ErrorNote error={save.error} />
    </Card>
  );
}

/** The day's finished workouts. */
export function DayWorkouts({ day }: { day: DayDto }) {
  return (
    <View style={{ gap: space.md }}>
      <Head
        title="Workouts"
        action={{
          label: day.date === day.today ? "Start a workout →" : "Workouts →",
          onPress: goTrain,
        }}
      />
      {day.workouts.length === 0 ? (
        <Card>
          <Muted>No workouts logged on this day.</Muted>
        </Card>
      ) : (
        day.workouts.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: w.id } })}
          >
            <Card style={{ gap: space.xs, borderColor: colors.neonDim }}>
              <View style={styles.head}>
                <Body style={{ fontWeight: "600", flex: 1 }}>{w.name}</Body>
                <Muted>
                  {formatElapsed(w.durationS)}
                  {w.volumeKg > 0 && ` · ${formatVolume(w.volumeKg, day.units)}`}
                </Muted>
              </View>
              {w.lines.map((l) => (
                <Muted key={l} style={{ fontSize: 13 }}>
                  {l}
                </Muted>
              ))}
              {w.prs.length > 0 && (
                <Text style={{ color: tierColor(75), fontSize: 13 }}>★ {w.prs.join(" · ")}</Text>
              )}
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

/** Weight and height for the day, when tracked. */
export function DayBody({ day }: { day: DayDto }) {
  const save = useSaveBody();
  const body = day.body;
  if (!body) return null;
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.head}>
        <Label>Body</Label>
        <TextLink href="/body">Trends →</TextLink>
      </View>
      <Card key={day.date} style={{ gap: space.md }}>
        {body.trackWeight && (
          <View style={styles.row}>
            <Text style={[styles.unit, { width: 60 }]}>Weight</Text>
            <WeightInput
              kg={body.weightKg}
              units={day.units}
              placeholderKg={body.lastWeightKg}
              onCommit={(weightKg) => day.editable && save.mutate({ date: day.date, weightKg })}
            />
          </View>
        )}
        {body.trackHeight && (
          <View style={styles.row}>
            <Text style={[styles.unit, { width: 60 }]}>Height</Text>
            <HeightInput
              cm={body.heightCm}
              units={day.units}
              placeholderCm={body.lastHeightCm}
              onCommit={(heightCm) => day.editable && save.mutate({ date: day.date, heightCm })}
            />
          </View>
        )}
        {save.isPending && <Muted style={{ fontSize: 12 }}>Saving…</Muted>}
        <ErrorNote error={save.error} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  link: { color: colors.neon, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  unit: { color: colors.court300, fontSize: 15 },
  amount: { width: 96, textAlign: "right", paddingVertical: 8 },
  plus: {
    width: 40,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
});
