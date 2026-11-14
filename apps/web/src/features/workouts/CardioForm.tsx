import {
  addDays,
  cardioSession,
  distanceUnit,
  formatDuration,
  formatPace,
  fromDisplayDistance,
  isCardioLine,
  parseDuration,
  toDisplayDistance,
  type CardioInput,
  type ExerciseDto,
  type WorkoutDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useDay } from "../../api/days";
import { useExercises, useSaveCardio } from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { EffortPicker } from "./BoxScore";
import { useUnits } from "./WorkoutsNav";

const FT_PER_M = 3.28084;
const label = "block text-xs uppercase tracking-wider text-court-300";

export { effortLabel } from "./BoxScore";

/** Cardio activities: the library's cardio exercises (and custom ones) that record time. */
export function useCardioActivities(): ExerciseDto[] {
  const exercises = useExercises();
  return (exercises.data ?? []).filter((e) => e.category === "cardio" && isCardioLine(e.stats));
}

const num = (text: string) => {
  const n = Number(text.trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Log a cardio session, or edit one (`session`). */
export function CardioForm({
  session,
  onDone,
  onCancel,
}: {
  session?: WorkoutDto;
  onDone: (workout: WorkoutDto) => void;
  onCancel: () => void;
}) {
  const units = useUnits();
  const today = useDay(null).data?.today;
  const activities = useCardioActivities();
  const save = useSaveCardio(session?.id);
  const initial = session ? cardioSession(session) : null;
  const details = session?.boxScore;

  const [activity, setActivity] = useState(initial?.activityId ?? "running");
  const [name, setName] = useState(session?.name ?? "");
  const [localDate, setLocalDate] = useState(session?.localDate ?? today ?? "");
  const [duration, setDuration] = useState(initial ? formatDuration(initial.durationS) : "");
  const [distance, setDistance] = useState(
    initial?.distanceM ? String(toDisplayDistance(initial.distanceM, units)) : "",
  );
  const [elevation, setElevation] = useState(
    details?.elevationM
      ? String(
          Math.round(units === "imperial" ? details.elevationM * FT_PER_M : details.elevationM),
        )
      : "",
  );
  const [heartRate, setHeartRate] = useState(details?.avgHeartRate?.toString() ?? "");
  const [maxHeartRate, setMaxHeartRate] = useState(details?.maxHeartRate?.toString() ?? "");
  const [calories, setCalories] = useState(details?.calories?.toString() ?? "");
  const [effort, setEffort] = useState<number | null>(details?.effort ?? null);
  const [notes, setNotes] = useState(session?.notes ?? "");

  const info = activities.find((a) => a.id === activity);
  const tracksDistance = info ? info.stats.includes("distance") : true;
  const durationS = parseDuration(duration);
  const distanceM =
    tracksDistance && num(distance) ? fromDisplayDistance(num(distance)!, units) : null;
  const pace = formatPace(activity, distanceM, durationS, units);
  const date = localDate || today || "";
  const valid = Boolean(info && durationS && durationS > 0 && date);

  const submit = () => {
    if (!valid) return;
    const elev = num(elevation);
    const input: CardioInput = {
      activity,
      ...(name.trim() && { name: name.trim() }),
      notes,
      localDate: date,
      durationS: durationS!,
      distanceM,
      elevationM: elev === null ? null : units === "imperial" ? elev / FT_PER_M : elev,
      avgHeartRate: num(heartRate) === null ? null : Math.round(num(heartRate)!),
      maxHeartRate: num(maxHeartRate) === null ? null : Math.round(num(maxHeartRate)!),
      calories: num(calories) === null ? null : Math.round(num(calories)!),
      effort,
    };
    save.mutate(input, { onSuccess: onDone });
  };

  return (
    <form
      aria-label={session ? "Edit cardio session" : "Log cardio"}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="space-y-2">
        <legend className={label}>Activity</legend>
        <div className="flex flex-wrap gap-2">
          {activities.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === activity}
              onClick={() => setActivity(a.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${a.id === activity ? "border-neon bg-neon/15 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
            >
              {a.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-court-500">
          Missing one? Add it under{" "}
          <Link to="/workouts/exercises" className="text-neon hover:underline">
            Exercises
          </Link>{" "}
          with the Cardio category.
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className={label}>Time</span>
          <input
            value={duration}
            required
            placeholder="h:mm:ss or minutes"
            inputMode="text"
            aria-invalid={duration.trim() !== "" && !durationS}
            onChange={(e) => setDuration(e.target.value)}
            className={`${compactFieldClass} w-full tabular-nums`}
          />
        </label>
        {tracksDistance && (
          <label className="space-y-1">
            <span className={label}>Distance ({distanceUnit(units)})</span>
            <input
              value={distance}
              inputMode="decimal"
              placeholder="Optional"
              onChange={(e) => setDistance(e.target.value)}
              className={`${compactFieldClass} w-full tabular-nums`}
            />
          </label>
        )}
        <label className="space-y-1">
          <span className={label}>Day</span>
          <input
            type="date"
            value={date}
            required
            max={today}
            min={today ? addDays(today, -365 * 5) : undefined}
            onChange={(e) => setLocalDate(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
      </div>

      <p className="rounded-lg bg-court-900 px-3 py-2 text-sm text-court-300" aria-live="polite">
        {pace ? (
          <>
            Pace <span className="font-semibold tabular-nums text-neon">{pace}</span>
          </>
        ) : (
          "Add a time and distance to see your pace."
        )}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className={label}>Avg HR</span>
          <input
            value={heartRate}
            inputMode="numeric"
            placeholder="bpm"
            onChange={(e) => setHeartRate(e.target.value)}
            className={`${compactFieldClass} w-full tabular-nums`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Max HR</span>
          <input
            value={maxHeartRate}
            inputMode="numeric"
            placeholder="bpm"
            onChange={(e) => setMaxHeartRate(e.target.value)}
            className={`${compactFieldClass} w-full tabular-nums`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Calories</span>
          <input
            value={calories}
            inputMode="numeric"
            placeholder="kcal"
            onChange={(e) => setCalories(e.target.value)}
            className={`${compactFieldClass} w-full tabular-nums`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Climb ({units === "imperial" ? "ft" : "m"})</span>
          <input
            value={elevation}
            inputMode="numeric"
            placeholder="Optional"
            onChange={(e) => setElevation(e.target.value)}
            className={`${compactFieldClass} w-full tabular-nums`}
          />
        </label>
      </div>

      <EffortPicker value={effort} onChange={setEffort} />

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="space-y-1">
          <span className={label}>Name</span>
          <input
            value={name}
            maxLength={80}
            placeholder={info?.name ?? "Cardio"}
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Notes</span>
          <input
            value={notes}
            maxLength={2000}
            placeholder="Route, weather, how it felt"
            onChange={(e) => setNotes(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
      </div>

      <ErrorNote error={save.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!valid || save.isPending}>
          {save.isPending ? "Saving…" : session ? "Save changes" : "Log session"}
        </Button>
      </div>
    </form>
  );
}
