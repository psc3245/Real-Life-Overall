import {
  makePct,
  RECORD_LABELS,
  SPORT_LABELS,
  type ExerciseDto,
  type SportSkillDto,
  type SportTotalsDto,
  type UnitSystem,
} from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useExercises, useSportOverview } from "@/api/workouts";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Card, ErrorNote, Label, Muted } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";
import { formatElapsed, formatRecord, since, useUnits } from "@/lib/workouts";
import { WorkoutCard } from "./WorkoutCard";

/** Train's Sports view, under the practice start and plans: totals, skills, recent practices. */
export function SportStats() {
  const units = useUnits();
  const overview = useSportOverview();
  const exercises = useExercises();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const o = overview.data;

  if (overview.isPending) return <Muted>Loading…</Muted>;
  if (!o) return <ErrorNote error={overview.error} onRetry={() => void overview.refetch()} />;
  return (
    <View style={{ gap: space.lg }}>
      <Totals title="Last 7 days" totals={o.week} />
      <Totals title="Last 30 days" totals={o.month} />

      {o.skills.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Skills</Label>
          {o.skills.map((s) => (
            <SkillCard key={s.exerciseId} skill={s} info={byId.get(s.exerciseId)} units={units} />
          ))}
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <Label>Recent practices</Label>
        {o.recent.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: "center" }}>
              A practice works like a workout: add drills (free throws, ball handling, cone drills,
              serves), check off sets as you go, and it counts on the day&apos;s log and in its
              recap.
            </Muted>
          </Card>
        ) : (
          o.recent.map((w) => <WorkoutCard key={w.id} workout={w} byId={byId} units={units} />)
        )}
      </View>
    </View>
  );
}

function Totals({ title, totals: t }: { title: string; totals: SportTotalsDto }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{title}</Label>
      <StatGrid>
        <StatTile label="Practices" value={t.sessions} />
        <StatTile label="Time" value={t.durationS > 0 ? formatElapsed(t.durationS) : "—"} />
      </StatGrid>
    </View>
  );
}

/** A drill: its sport, sessions, all-time best and, for shooting-style drills, 30-day %. */
function SkillCard({
  skill: s,
  info,
  units,
}: {
  skill: SportSkillDto;
  info?: ExerciseDto;
  units: UnitSystem;
}) {
  const pct = s.recent ? makePct(s.recent.makes, s.recent.attempts) : null;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() =>
        router.push({ pathname: "/workouts/exercises/[id]", params: { id: s.exerciseId } })
      }
    >
      <Card style={{ gap: space.xs }}>
        <Text style={styles.title}>{info?.name ?? "Unknown drill"}</Text>
        <Muted style={{ fontSize: 12 }}>
          {info?.sport ? `${SPORT_LABELS[info.sport]} · ` : ""}
          {s.sessions} session{s.sessions === 1 ? "" : "s"} · {since(s.lastDone)}
        </Muted>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>{RECORD_LABELS[s.headline]}</Text>
            <Text style={styles.statValue}>
              {s.best !== null && info ? formatRecord(s.headline, s.best, units, info.stats) : "—"}
            </Text>
          </View>
          {s.recent && (
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>Last 30 days</Text>
              <Text style={styles.statValue}>
                {pct !== null ? `${pct}% (${s.recent.makes}/${s.recent.attempts})` : "—"}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", gap: space.sm, paddingTop: space.xs },
  statLabel: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  statValue: { color: colors.court100, fontSize: 14, fontVariant: ["tabular-nums"] },
});
