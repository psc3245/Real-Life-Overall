import { OBJECTIVE_TERM_LABELS, type ObjectiveDto, type ObjectiveTerm } from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useDeleteObjective, useObjectives } from "@/api/objectives";
import { useRatings } from "@/api/ratings";
import { chartParams } from "@/lib/chartModel";
import { useFeature } from "@/api/preferences";
import { shortDate } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { ObjectiveAmount, ObjectiveBar, objectiveStatusText, statusColor } from "./goals";
import { NodeChip } from "./NodeChip";
import { Button, Card, ErrorNote, Label, Loading, Muted } from "./ui";

const TERM_DETAIL: Record<ObjectiveTerm, string> = {
  short: "A month or less",
  long: "Longer than a month",
};

/** Goals with a deadline: short and long term, then finished ones. */
export function GoalsView() {
  const objectives = useObjectives();
  const ratings = useRatings();
  const [showFinished, setShowFinished] = useState(false);

  if (objectives.isPending) return <Loading />;
  if (objectives.isError) {
    return <ErrorNote error={objectives.error} onRetry={() => void objectives.refetch()} />;
  }
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  const all = objectives.data;
  const open = all.filter(
    (o) => o.progress.status === "active" || o.progress.status === "upcoming",
  );
  const finished = all
    .filter((o) => o.progress.status === "completed" || o.progress.status === "missed")
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn));

  return (
    <View style={{ gap: space.lg }}>
      <Button title="+ New goal" onPress={() => router.push("/goals/edit")} />
      {all.length === 0 && (
        <Card style={{ gap: space.xs }}>
          <Muted style={{ textAlign: "center" }}>No goals yet.</Muted>
          <Muted style={{ textAlign: "center", fontSize: 13, color: colors.court500 }}>
            Something like &quot;Run 100 miles before New Year&apos;s&quot; or &quot;Gym 3 times
            this week&quot;. Log progress on the goal each day, or have it count one of your habits.
          </Muted>
        </Card>
      )}
      {(["short", "long"] as const).map((term) => {
        const goals = open.filter((o) => o.term === term);
        if (!goals.length) return null;
        return (
          <View key={term} style={{ gap: space.sm }}>
            <Text style={styles.heading}>
              {OBJECTIVE_TERM_LABELS[term]}{" "}
              <Text style={styles.headingDetail}>{TERM_DETAIL[term]}</Text>
            </Text>
            {goals.map((o) => (
              <GoalCard key={o.id} objective={o} names={names} />
            ))}
          </View>
        );
      })}
      {finished.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Pressable onPress={() => setShowFinished((v) => !v)} accessibilityRole="button">
            <Label>
              Finished ({finished.filter((o) => o.progress.status === "completed").length}/
              {finished.length} reached) {showFinished ? "▾" : "▸"}
            </Label>
          </Pressable>
          {showFinished && finished.map((o) => <GoalCard key={o.id} objective={o} names={names} />)}
        </View>
      )}
    </View>
  );
}

function GoalCard({
  objective: o,
  names,
}: {
  objective: ObjectiveDto;
  names: Map<string, string>;
}) {
  const remove = useDeleteObjective();
  const charts = useFeature("charts");
  const p = o.progress;
  const done = p.status === "completed";

  const logAction =
    p.status !== "active"
      ? null
      : o.source === "manual"
        ? { label: "Log today →", go: () => router.push("/log") }
        : o.source === "workouts"
          ? {
              label: "Start a workout →",
              go: () => router.push({ pathname: "/habits", params: { view: "train" } }),
            }
          : { label: `Log ${o.habitName ?? "the habit"} →`, go: () => router.push("/log") };

  const menu = () => {
    const actions = [
      { label: "Edit", run: () => router.push({ pathname: "/goals/edit", params: { id: o.id } }) },
      ...(charts
        ? [
            {
              label: "Chart",
              run: () =>
                router.push({
                  pathname: "/charts",
                  params: chartParams([`goal:${o.id}`], { range: "all" }),
                }),
            },
          ]
        : []),
      {
        label: "Delete",
        run: () =>
          Alert.alert("Delete this goal?", o.name, [
            { text: "Keep", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate(o.id) },
          ]),
      },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: o.name,
        options: [...actions.map((a) => a.label), "Cancel"],
        destructiveButtonIndex: actions.length - 1,
        cancelButtonIndex: actions.length,
        userInterfaceStyle: "dark",
      },
      (i) => actions[i]?.run(),
    );
  };

  return (
    <Pressable onLongPress={menu} delayLongPress={300}>
      <Card style={[{ gap: space.sm }, done && { borderColor: colors.neonDim }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {done && <Text style={{ color: colors.neon }}>✓ </Text>}
              {o.name}
            </Text>
            <Muted style={{ fontSize: 12, color: colors.court500 }}>
              {shortDate(o.startsOn)} – {shortDate(o.endsOn)}
              {o.habitName && ` · counts ${o.habitName}`}
            </Muted>
          </View>
          <Pressable onPress={menu} hitSlop={10} accessibilityLabel={`${o.name} options`}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        <ObjectiveAmount objective={o} size={20} />
        <ObjectiveBar objective={o} />
        <Text style={{ color: statusColor(o), fontSize: 14 }}>{objectiveStatusText(o)}</Text>
        {o.links.length > 0 && (
          <View style={styles.links}>
            {o.links.map((id) => (
              <NodeChip key={id} id={id} name={names.get(id)} />
            ))}
          </View>
        )}
        {logAction && (
          <Pressable onPress={logAction.go} hitSlop={6}>
            <Text style={{ color: colors.neon, fontSize: 14 }}>{logAction.label}</Text>
          </Pressable>
        )}
        <ErrorNote error={remove.error} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headingDetail: {
    color: colors.court500,
    fontFamily: undefined,
    fontSize: 13,
    letterSpacing: 0,
    textTransform: "none",
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  name: { color: colors.court100, fontSize: 16, fontWeight: "600" },
  more: { color: colors.court300, fontSize: 16, letterSpacing: 1 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
