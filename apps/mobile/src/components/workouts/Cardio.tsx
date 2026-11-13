import {
  cardioLine,
  cardioSession,
  distanceUnit,
  formatDuration,
  formatPace,
  isCardioTracking,
  toDisplayDistance,
  type CardioTotalsDto,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutDto,
} from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCardioOverview, useExercises } from "@/api/workouts";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Button, Card, ErrorNote, Label, Muted } from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { formatElapsed, useUnits } from "@/lib/workouts";

export const FT_PER_M = 3.28084;

/** 1–3 easy, 4–6 steady, 7–8 hard, 9–10 all out. */
export function effortLabel(effort: number) {
  if (effort <= 3) return "Easy";
  if (effort <= 6) return "Steady";
  if (effort <= 8) return "Hard";
  return "All out";
}

/** Cardio activities: the library's cardio exercises (and custom ones) that record time. */
export function useCardioActivities(): ExerciseDto[] {
  const exercises = useExercises();
  return (exercises.data ?? []).filter(
    (e) => e.category === "cardio" && isCardioTracking(e.tracking),
  );
}

const distanceText = (m: number, units: UnitSystem) =>
  `${toDisplayDistance(m, units)} ${distanceUnit(units)}`;

/** Train's Cardio view: log a session, the last 7 and 30 days, bests, recent sessions. */
export function CardioHome() {
  const units = useUnits();
  const overview = useCardioOverview();
  const exercises = useExercises();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const o = overview.data;

  return (
    <View style={{ gap: space.lg }}>
      <Button title="Log cardio" onPress={() => router.push("/workouts/cardio")} />
      {overview.isPending && <Muted>Loading…</Muted>}
      <ErrorNote error={overview.error} onRetry={() => void overview.refetch()} />
      {o && (
        <>
          <Totals title="Last 7 days" totals={o.week} units={units} />
          <Totals title="Last 30 days" totals={o.month} units={units} />

          {o.activities.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Label>Bests</Label>
              {o.activities.map((a) => (
                <Pressable
                  key={a.activityId}
                  accessibilityRole="link"
                  onPress={() =>
                    router.push({
                      pathname: "/workouts/exercises/[id]",
                      params: { id: a.activityId },
                    })
                  }
                >
                  <Card style={{ gap: space.xs }}>
                    <Text style={styles.title}>
                      {byId.get(a.activityId)?.name ?? "Unknown activity"}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      {a.sessions} session{a.sessions === 1 ? "" : "s"}
                      {a.distanceM > 0 ? ` · ${distanceText(a.distanceM, units)} total` : ""}
                    </Muted>
                    <View style={styles.bests}>
                      <Best
                        label="Longest"
                        value={a.longestM ? distanceText(a.longestM, units) : "—"}
                      />
                      <Best label="Time" value={a.longestS ? formatDuration(a.longestS) : "—"} />
                      <Best
                        label="Best pace"
                        value={
                          a.bestPaceSPerKm
                            ? (formatPace(a.activityId, 1000, a.bestPaceSPerKm, units) ?? "—")
                            : "—"
                        }
                      />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ gap: space.sm }}>
            <Label>Recent</Label>
            {o.recent.length === 0 ? (
              <Card>
                <Muted style={{ textAlign: "center" }}>
                  Runs, rides, swims and walks go here: time, distance, pace, heart rate and how
                  hard it felt. They count on the day's log and in its recap like any workout.
                </Muted>
              </Card>
            ) : (
              o.recent.map((w) => <CardioCard key={w.id} workout={w} byId={byId} units={units} />)
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Totals({
  title,
  totals: t,
  units,
}: {
  title: string;
  totals: CardioTotalsDto;
  units: UnitSystem;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{title}</Label>
      <StatGrid>
        <StatTile label="Sessions" value={t.sessions} />
        <StatTile
          label={distanceUnit(units)}
          value={t.distanceM > 0 ? toDisplayDistance(t.distanceM, units) : "—"}
        />
        <StatTile label="Time" value={t.durationS > 0 ? formatElapsed(t.durationS) : "—"} />
      </StatGrid>
    </View>
  );
}

function Best({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.bestLabel}>{label}</Text>
      <Text style={styles.bestValue}>{value}</Text>
    </View>
  );
}

/** A cardio session in a list: name, day and its one-line summary. */
export function CardioCard({
  workout: w,
  byId,
  units,
}: {
  workout: WorkoutDto;
  byId: Map<string, ExerciseDto>;
  units: UnitSystem;
}) {
  const s = cardioSession(w);
  const activity = byId.get(s.activityId)?.name;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: w.id } })}
      accessibilityRole="link"
    >
      <Card style={{ gap: space.xs }}>
        <View style={styles.head}>
          <Text style={[styles.title, { flex: 1 }]}>{w.name}</Text>
          <Text style={styles.tag}>Cardio</Text>
        </View>
        <Muted style={{ fontSize: 12 }}>
          {dayLabel(w.localDate)}
          {activity && activity !== w.name ? ` · ${activity}` : ""}
        </Muted>
        <Muted>{cardioLine(s.activityId, s.distanceM, s.durationS, w.cardio, units)}</Muted>
        {w.summary.prs.length > 0 && (
          <Muted style={{ color: tierColor(75) }}>
            ★ {w.summary.prs.length} PR{w.summary.prs.length === 1 ? "" : "s"}
          </Muted>
        )}
      </Card>
    </Pressable>
  );
}

/** A finished cardio session's numbers (the session screen). */
export function CardioStats({ workout: w, units }: { workout: WorkoutDto; units: UnitSystem }) {
  const s = cardioSession(w);
  const c = w.cardio;
  const pace = formatPace(s.activityId, s.distanceM, s.durationS, units);
  return (
    <StatGrid>
      <StatTile label="Time" value={formatDuration(s.durationS)} />
      <StatTile
        label={distanceUnit(units)}
        value={s.distanceM ? toDisplayDistance(s.distanceM, units) : "—"}
      />
      <StatTile label="Pace" value={pace ?? "—"} />
      {c?.avgHeartRate ? <StatTile label="Avg HR" value={c.avgHeartRate} /> : null}
      {c?.calories ? <StatTile label="Calories" value={c.calories} /> : null}
      {c?.elevationM ? (
        <StatTile
          label={`Climb (${units === "imperial" ? "ft" : "m"})`}
          value={Math.round(units === "imperial" ? c.elevationM * FT_PER_M : c.elevationM)}
        />
      ) : null}
      {c?.effort ? (
        <StatTile label="Effort" value={`${c.effort}/10`} detail={effortLabel(c.effort)} />
      ) : null}
    </StatGrid>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  tag: {
    color: colors.neon,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bests: { flexDirection: "row", gap: space.sm, paddingTop: space.xs },
  bestLabel: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bestValue: { color: colors.court100, fontSize: 14, fontVariant: ["tabular-nums"] },
});
