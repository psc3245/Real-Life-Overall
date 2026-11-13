import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { templatesKey, workoutsKey } from "@/api/workouts";
import { FeatureGate } from "@/components/FeatureGate";
import { Screen } from "@/components/ui";
import { TrainHome } from "@/components/workouts/TrainHome";
import { useTalk } from "@/lib/talk";

/** The Workouts tab: start, resume and review training (the web's Train page). */
function TrainScreen() {
  const talk = useTalk();
  const params = useLocalSearchParams<{ resume?: string }>();
  // Opening the app with a workout in progress lands here with ?resume=1.
  useEffect(() => {
    if (params.resume !== "1") return;
    router.setParams({ resume: "" });
    router.push("/workouts/active");
  }, [params.resume]);
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all(
      [workoutsKey, templatesKey].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  return (
    <Screen title={talk.nav.workouts} onRefresh={refresh}>
      <TrainHome />
    </Screen>
  );
}

export default function GatedTrainScreen() {
  return (
    <FeatureGate feature="workouts">
      <TrainScreen />
    </FeatureGate>
  );
}
