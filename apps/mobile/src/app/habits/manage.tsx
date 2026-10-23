import { GROUP_RULE_LABELS, HABIT_TYPE_LABELS, type HabitDto } from "@rlo/shared";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useArchiveHabit, useHabits } from "@/api/days";
import { useRatings } from "@/api/ratings";
import { Body, Button, Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { scheduleLabel } from "@/lib/habits";
import { colors, space } from "@/lib/theme";

const edit = (params: { id?: string; parent?: string }) =>
  router.push({ pathname: "/habits/edit", params });

/** Every habit and group: edit, archive, add habits and sub-habits. */
export default function ManageHabitsScreen() {
  const habits = useHabits();
  const ratings = useRatings();
  const archive = useArchiveHabit();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  if (habits.isPending) return <Loading />;
  if (habits.isError) {
    return (
      <Screen>
        <ErrorNote error={habits.error} onRetry={() => void habits.refetch()} />
      </Screen>
    );
  }

  const confirmArchive = (h: HabitDto) =>
    Alert.alert(
      `Archive ${h.name}?`,
      h.type === "group" ? "The group and its sub-habits are archived." : "History is kept.",
      [
        { text: "Keep", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: () => archive.mutate(h.id) },
      ],
    );

  const row = (h: HabitDto) => (
    <Pressable onPress={() => edit({ id: h.id })} onLongPress={() => confirmArchive(h)}>
      <Card style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body style={{ fontWeight: "600" }}>{h.name}</Body>
          <Muted style={{ fontSize: 13 }}>
            {HABIT_TYPE_LABELS[h.type]}
            {h.type === "group" &&
              ` · ${GROUP_RULE_LABELS[h.config.rule ?? "all"]}${h.config.rule === "count" ? ` (${h.config.target})` : ""}`}
            {!h.parentId && ` · ${scheduleLabel(h.days)} · since ${h.startsOn}`}
            {h.links.length > 0 && ` · ${h.links.map((id) => names.get(id) ?? "?").join(", ")}`}
          </Muted>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Archive ${h.name}`}
          hitSlop={8}
          onPress={() => confirmArchive(h)}
        >
          <Muted style={{ color: colors.flare }}>Archive</Muted>
        </Pressable>
      </Card>
    </Pressable>
  );

  return (
    <Screen
      eyebrow="Habits"
      title="Manage"
      onRefresh={() => void habits.refetch()}
      refreshing={habits.isRefetching}
    >
      <Button title="+ New habit" onPress={() => edit({})} />
      {habits.data.length === 0 && (
        <Card>
          <Muted>
            Habits are the structured half of your day log. Link each one to the attributes it
            builds so recaps know what your effort means.
          </Muted>
        </Card>
      )}
      {habits.data
        .filter((h) => !h.parentId)
        .map((h) => (
          <View key={h.id} style={{ gap: space.sm }}>
            {row(h)}
            {h.type === "group" && (
              <View style={styles.subs}>
                {habits.data
                  .filter((c) => c.parentId === h.id)
                  .map((c) => (
                    <View key={c.id}>{row(c)}</View>
                  ))}
                <Button
                  title="+ Sub-habit"
                  variant="ghost"
                  onPress={() => edit({ parent: h.id })}
                />
              </View>
            )}
          </View>
        ))}
      <Muted style={{ fontSize: 13 }}>Tap a habit to edit it.</Muted>
      <ErrorNote error={archive.error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  subs: {
    marginLeft: space.md,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.court700,
    gap: space.sm,
  },
});
