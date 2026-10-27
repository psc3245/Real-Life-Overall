import { router } from "expo-router";
import { useExercises, useWorkoutHistory } from "@/api/workouts";
import { ChartButton } from "@/components/ChartButton";
import { Button, Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

function WorkoutHistoryScreen() {
  const history = useWorkoutHistory();
  const exercises = useExercises();
  const units = useUnits();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const workouts = history.data?.pages.flatMap((p) => p.workouts) ?? [];

  if (history.isPending) return <Loading title="History" />;
  return (
    <Screen eyebrow="Training" title="History" onRefresh={() => history.refetch()}>
      <ChartButton
        ids={["workouts:volume", "workouts:count"]}
        config={{ bucket: "week", style: "bar" }}
        label="Chart weekly volume and workouts →"
      />
      <ErrorNote error={history.error} />
      {history.isSuccess && workouts.length === 0 && (
        <Card>
          <Muted style={{ textAlign: "center" }}>No workouts yet.</Muted>
          <Button
            title="Start one"
            variant="ghost"
            onPress={() => router.push({ pathname: "/habits", params: { view: "train" } })}
          />
        </Card>
      )}
      {workouts.map((w) => (
        <WorkoutCard key={w.id} workout={w} byId={byId} units={units} />
      ))}
      {history.hasNextPage && (
        <Button
          title={history.isFetchingNextPage ? "Loading…" : "Load more"}
          variant="ghost"
          disabled={history.isFetchingNextPage}
          onPress={() => void history.fetchNextPage()}
        />
      )}
    </Screen>
  );
}

export default function GatedWorkoutHistoryScreen() {
  return (
    <FeatureGate feature="workouts">
      <WorkoutHistoryScreen />
    </FeatureGate>
  );
}
