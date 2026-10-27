import type { Feature } from "@rlo/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { usePreferences } from "@/api/preferences";
import { useQueryClient } from "@tanstack/react-query";
import { habitsKey } from "@/api/days";
import { objectivesKey } from "@/api/objectives";
import { templatesKey, workoutsKey } from "@/api/workouts";
import { Segmented } from "@/components/controls";
import { GoalsView } from "@/components/GoalsView";
import { HabitsGlance } from "@/components/HabitsGlance";
import { Card, Muted, Screen } from "@/components/ui";
import { TrainHome } from "@/components/workouts/TrainHome";
import { useTalk } from "@/lib/talk";

type View = "habits" | "goals" | "train";
const VIEWS: { value: View; feature: Feature }[] = [
  { value: "habits", feature: "habits" },
  { value: "goals", feature: "goals" },
  { value: "train", feature: "workouts" },
];

/**
 * The Playbook tab: the web's Playbook menu (Habits, Goals, Train) as one screen with a switch.
 * Parts switched off in Personalize drop out of the switch.
 */
export default function PlaybookScreen() {
  const talk = useTalk();
  const { features } = usePreferences();
  const params = useLocalSearchParams<{ view?: View }>();
  const available = VIEWS.filter((v) => features[v.feature]);
  const [view, setView] = useState<View>(params.view ?? available[0]?.value ?? "habits");
  // Links like "Start a workout →" land here with ?view=train.
  useEffect(() => {
    if (params.view) setView(params.view);
  }, [params.view]);
  const shown = available.some((v) => v.value === view) ? view : available[0]?.value;

  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all(
      (shown === "habits"
        ? [habitsKey]
        : shown === "goals"
          ? [objectivesKey]
          : [workoutsKey, templatesKey]
      ).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const labels: Record<View, string> = {
    habits: "Habits",
    goals: "Goals",
    train: talk.nav.workouts,
  };
  return (
    <Screen title={talk.nav.plan} onRefresh={refresh}>
      {available.length > 1 && (
        <Segmented
          label={talk.nav.plan}
          options={available.map((v) => ({ value: v.value, label: labels[v.value] }))}
          value={shown ?? "habits"}
          onChange={setView}
        />
      )}
      {!shown && (
        <Card>
          <Muted>Habits, goals and workouts are all switched off in Personalize.</Muted>
        </Card>
      )}
      {shown === "habits" && <HabitsGlance />}
      {shown === "goals" && <GoalsView />}
      {shown === "train" && <TrainHome />}
    </Screen>
  );
}
