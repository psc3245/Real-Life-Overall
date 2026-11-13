import type { Feature } from "@rlo/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { usePreferences } from "@/api/preferences";
import { useQueryClient } from "@tanstack/react-query";
import { habitsKey } from "@/api/days";
import { objectivesKey } from "@/api/objectives";
import { Segmented } from "@/components/controls";
import { GoalsView } from "@/components/GoalsView";
import { HabitsGlance } from "@/components/HabitsGlance";
import { Card, Muted, Screen } from "@/components/ui";
import { useTalk } from "@/lib/talk";

type View = "habits" | "goals";
const VIEWS: { value: View; feature: Feature }[] = [
  { value: "habits", feature: "habits" },
  { value: "goals", feature: "goals" },
];

/**
 * The Playbook tab: habits and goals as one screen with a switch (training has its own tab).
 * Parts switched off in Personalize drop out of the switch.
 */
export default function PlaybookScreen() {
  const talk = useTalk();
  const { features } = usePreferences();
  const params = useLocalSearchParams<{ view?: View }>();
  const available = VIEWS.filter((v) => features[v.feature]);
  const [view, setView] = useState<View>(params.view ?? available[0]?.value ?? "habits");
  // Links like "Goals →" land here with ?view=goals.
  useEffect(() => {
    if (params.view) setView(params.view);
  }, [params.view]);
  const shown = available.some((v) => v.value === view) ? view : available[0]?.value;

  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all(
      (shown === "habits" ? [habitsKey] : [objectivesKey]).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  const labels: Record<View, string> = {
    habits: talk.nav.habits,
    goals: talk.nav.goals,
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
          <Muted>Habits and goals are both switched off in Personalize.</Muted>
        </Card>
      )}
      {shown === "habits" && <HabitsGlance />}
      {shown === "goals" && <GoalsView />}
    </Screen>
  );
}
