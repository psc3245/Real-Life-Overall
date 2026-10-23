import { isDayHabitDone } from "@rlo/shared";
import { StyleSheet, Text, View } from "react-native";
import { useDay, useRatings, useSaveEntry } from "@/api/queries";
import { HabitRow } from "@/components/HabitRow";
import { OvrBadge, Trend } from "@/components/ratings";
import { Body, Card, ErrorNote, Label, Loading, Muted, Screen } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";

const RECAP_STATUS = {
  open: "Not recapped yet. End your day on the web, or the 4am job recaps it.",
  recapped: "Recapped.",
  stale: "Edited since its recap.",
} as const;

/** At a glance: Overall, today's habits (loggable here) and the day's recap state. */
export default function TodayScreen() {
  const ratings = useRatings();
  const day = useDay(null);
  const save = useSaveEntry(day.data?.date ?? "");

  const refreshing = ratings.isRefetching || day.isRefetching;
  const refresh = () => void Promise.all([ratings.refetch(), day.refetch()]);

  if (ratings.isPending || day.isPending) return <Loading title="Today" />;
  if (ratings.isError || day.isError) {
    return (
      <Screen title="Today" onRefresh={refresh} refreshing={refreshing}>
        <ErrorNote error={ratings.error ?? day.error} onRetry={refresh} />
      </Screen>
    );
  }

  const overall = ratings.data?.nodes.find((n) => n.parentId === null) ?? null;
  const habits = day.data.habits.filter((h) => h.scheduled);
  const done = habits.filter(isDayHabitDone).length;

  return (
    <Screen title="Today" onRefresh={refresh} refreshing={refreshing}>
      {ratings.data && overall ? (
        <Card style={styles.hero}>
          <OvrBadge value={overall.value} />
          <View style={styles.heroText}>
            <Label>{ratings.data.season.label}</Label>
            {ratings.data.archetype && (
              <Text style={styles.archetype}>{ratings.data.archetype.name}</Text>
            )}
            <View style={styles.trendRow}>
              <Muted>7 days</Muted>
              <Trend value={overall.trend} />
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Body>No ratings yet. Finish onboarding on the web to get your OVR.</Body>
        </Card>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Label>Habits</Label>
          {habits.length > 0 && (
            <Muted>
              {done}/{habits.length} done
            </Muted>
          )}
        </View>
        <Card style={styles.list}>
          {habits.length === 0 ? (
            <Muted>Nothing scheduled today.</Muted>
          ) : (
            habits.map((item) => (
              <HabitRow
                key={item.habit.id}
                item={item}
                editable={day.data.editable}
                onSave={(habitId, value) => save.mutate({ habitId, value })}
              />
            ))
          )}
        </Card>
        {save.isError && <ErrorNote error={save.error} />}
      </View>

      <View style={styles.section}>
        <Label>Recap</Label>
        <Card style={styles.list}>
          <Muted>{RECAP_STATUS[day.data.status]}</Muted>
          {day.data.recap && <Body>{day.data.recap.narrative}</Body>}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  heroText: { flex: 1, gap: space.xs },
  archetype: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 24 },
  trendRow: { flexDirection: "row", gap: space.sm, alignItems: "baseline" },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  list: { gap: space.sm },
});
