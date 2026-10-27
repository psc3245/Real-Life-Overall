import {
  bestSet,
  formatSet,
  SET_KIND_TAGS,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutDto,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Muted } from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { formatElapsed, formatVolume } from "@/lib/workouts";

/** A finished workout in a list: time, volume, PRs and each exercise's best set. */
export function WorkoutCard({
  workout: w,
  byId,
  units,
}: {
  workout: WorkoutDto;
  byId: Map<string, ExerciseDto>;
  units: UnitSystem;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: w.id } })}
      accessibilityRole="link"
    >
      <Card style={{ gap: space.sm }}>
        <View>
          <Text style={styles.title}>{w.name}</Text>
          <Muted style={{ fontSize: 12 }}>{dayLabel(w.localDate)}</Muted>
        </View>
        <View style={styles.meta}>
          <Muted>⏱ {formatElapsed(w.summary.durationS)}</Muted>
          {w.summary.volumeKg > 0 && <Muted>{formatVolume(w.summary.volumeKg, units)}</Muted>}
          {w.summary.prs.length > 0 && (
            <Muted style={{ color: tierColor(75) }}>
              ★ {w.summary.prs.length} PR{w.summary.prs.length === 1 ? "" : "s"}
            </Muted>
          )}
        </View>
        {w.exercises.map((e, i) => {
          const info = byId.get(e.exerciseId);
          const best = info ? bestSet(info.tracking, e.sets) : null;
          return (
            <View key={i} style={styles.line}>
              <Text style={styles.lineName} numberOfLines={1}>
                {e.sets.length} × {info?.name ?? "Unknown exercise"}
              </Text>
              <Muted style={{ fontSize: 13 }}>
                {best && info ? formatSet(info.tracking, best, units) : "—"}
              </Muted>
            </View>
          );
        })}
      </Card>
    </Pressable>
  );
}

/** One exercise of a finished workout, set by set. */
export function ExerciseSummary({
  exercise: e,
  info,
  units,
}: {
  exercise: WorkoutExerciseDto;
  info?: ExerciseDto;
  units: UnitSystem;
}) {
  let working = 0;
  return (
    <Card style={{ gap: space.xs }}>
      {info ? (
        <Link
          href={{ pathname: "/workouts/exercises/[id]", params: { id: info.id } }}
          style={styles.exercise}
        >
          {info.name}
        </Link>
      ) : (
        <Text style={[styles.exercise, { color: colors.court300 }]}>Unknown exercise</Text>
      )}
      {e.notes ? <Muted style={{ fontSize: 13 }}>{e.notes}</Muted> : null}
      {e.sets.map((s, i) => {
        if (s.kind !== "warmup") working += 1;
        return (
          <View key={i} style={{ flexDirection: "row", gap: space.md }}>
            <Text style={styles.setNo}>
              {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
            </Text>
            <Text style={styles.set}>{info ? formatSet(info.tracking, s, units) : "—"}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  lineName: { flex: 1, color: colors.court100, fontSize: 14 },
  exercise: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  setNo: { width: 22, textAlign: "center", color: colors.court500, fontWeight: "700" },
  set: { color: colors.court100, fontSize: 15, fontVariant: ["tabular-nums"] },
});
