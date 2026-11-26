import {
  MAX_GAME_PLANS,
  OBJECTIVE_TERM_LABELS,
  type GamePlanDto,
  type ObjectiveDto,
  type ObjectiveTerm,
} from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useDeleteGamePlan, useGamePlans } from "@/api/gamePlans";
import { useDeleteObjective, useObjectives } from "@/api/objectives";
import { useRatings } from "@/api/ratings";
import { chartParams } from "@/lib/chartModel";
import { useFeature } from "@/api/preferences";
import { shortDate } from "@/lib/format";
import { useTalk } from "@/lib/talk";
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
      <GamePlans names={names} />
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

/**
 * Game Plans (DESIGN.md §7.16): what the player is leaning into for a while, with no numbers.
 * The coach, recaps and weekly reviews read them; nothing is scored.
 */
function GamePlans({ names }: { names: Map<string, string> }) {
  const talk = useTalk();
  const plans = useGamePlans();
  const [showEnded, setShowEnded] = useState(false);
  if (!plans.data) return null;
  const open = plans.data.filter((p) => p.status !== "ended");
  const ended = plans.data.filter((p) => p.status === "ended");
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.heading}>
        {talk.gamePlan} <Text style={styles.headingDetail}>What you&apos;re leaning into</Text>
      </Text>
      {open.length === 0 && (
        <Muted style={{ fontSize: 13, color: colors.court500 }}>
          An emphasis for a while, like &quot;Build strength this winter&quot;. No numbers: the
          coach and your recaps keep it in mind.
        </Muted>
      )}
      {open.map((p) => (
        <PlanCard key={p.id} plan={p} names={names} />
      ))}
      {open.length < MAX_GAME_PLANS && (
        <Button
          title={`+ New ${talk.gamePlan.toLowerCase()}`}
          variant="ghost"
          onPress={() => router.push("/game-plans/edit")}
        />
      )}
      {ended.length > 0 && (
        <>
          <Pressable onPress={() => setShowEnded((v) => !v)} accessibilityRole="button">
            <Label>
              Ended ({ended.length}) {showEnded ? "▾" : "▸"}
            </Label>
          </Pressable>
          {showEnded && ended.map((p) => <PlanCard key={p.id} plan={p} names={names} />)}
        </>
      )}
    </View>
  );
}

function PlanCard({ plan: p, names }: { plan: GamePlanDto; names: Map<string, string> }) {
  const remove = useDeleteGamePlan();
  const menu = () => {
    const actions = [
      {
        label: "Edit",
        run: () => router.push({ pathname: "/game-plans/edit", params: { id: p.id } }),
      },
      {
        label: "Delete",
        run: () =>
          Alert.alert("Delete this?", p.name, [
            { text: "Keep", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate(p.id) },
          ]),
      },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: p.name,
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
      <Card style={[{ gap: space.xs }, p.status === "active" && { borderColor: colors.neonDim }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Muted style={{ fontSize: 12, color: colors.court500 }}>
              {p.status === "upcoming" ? "Starts " : ""}
              {shortDate(p.startsOn)} – {shortDate(p.endsOn)}
            </Muted>
          </View>
          <Pressable onPress={menu} hitSlop={10} accessibilityLabel={`${p.name} options`}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        {p.note !== "" && <Muted style={{ fontSize: 14 }}>{p.note}</Muted>}
        {p.links.length > 0 && (
          <View style={styles.links}>
            {p.links.map((id) => (
              <NodeChip key={id} id={id} name={names.get(id)} />
            ))}
          </View>
        )}
        <ErrorNote error={remove.error} />
      </Card>
    </Pressable>
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
              go: () => router.push("/train"),
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
