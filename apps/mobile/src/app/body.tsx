import { addDays, bmi, formatHeight, toDisplayWeight, weightUnit, type BodyDto } from "@rlo/shared";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useMe } from "@/api/hooks";
import { useBody, useSaveBody } from "@/api/workouts";
import { HeightInput, WeightInput } from "@/components/body/BodyInputs";
import { TrackingSettings } from "@/components/body/TrackingSettings";
import { ChartButton } from "@/components/ChartButton";
import { TrendChart } from "@/components/charts/MetricChart";
import { DateStepper } from "@/components/controls";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Card, ErrorNote, Label, Loading, Muted, Screen, Section } from "@/components/ui";
import { dayLabel } from "@/lib/format";
import { colors, space } from "@/lib/theme";

/** Height and weight over time, if the player tracks them. */
export default function BodyScreen() {
  const body = useBody();
  const me = useMe();
  const today = useDay(null).data?.today;

  if (body.isPending || me.isPending || !today) return <Loading title="Body" />;
  return (
    <Screen
      eyebrow="Training"
      title="Body"
      onRefresh={() => Promise.all([body.refetch(), me.refetch()])}
    >
      <ChartButton
        ids={["body:weight"]}
        config={{ range: "all", average: true, trend: true }}
        label="Chart and model weight →"
      />
      <ErrorNote error={body.error ?? me.error} />
      {body.data && me.data && (
        <>
          {body.data.trackWeight || body.data.trackHeight ? (
            <Tracked body={body.data} today={today} />
          ) : (
            <Card>
              <Muted style={{ textAlign: "center" }}>
                Height and weight tracking is off. Turn either on below to log it here and on each
                day&apos;s log.
              </Muted>
            </Card>
          )}
          <TrackingSettings me={me.data} />
        </>
      )}
    </Screen>
  );
}

function Tracked({ body, today }: { body: BodyDto; today: string }) {
  const units = body.unitSystem;
  const save = useSaveBody();
  const [date, setDate] = useState(today);
  const weights = body.entries.filter((e) => e.weightKg !== null);
  const heights = body.entries.filter((e) => e.heightCm !== null);
  const latestWeight = weights[0];
  const latestHeight = heights[0];
  const monthAgo = weights.find((e) => e.localDate <= addDays(today, -30));
  const change =
    latestWeight && monthAgo
      ? toDisplayWeight(latestWeight.weightKg! - monthAgo.weightKg!, units)
      : null;
  const onDate = body.entries.find((e) => e.localDate === date);
  const lb = weightUnit(units);

  return (
    <>
      <StatGrid>
        {body.trackWeight && (
          <StatTile
            label="Weight"
            value={latestWeight ? `${toDisplayWeight(latestWeight.weightKg!, units)}` : "—"}
            detail={latestWeight ? `${lb} · ${dayLabel(latestWeight.localDate)}` : "Not logged yet"}
          />
        )}
        {body.trackWeight && (
          <StatTile
            label="30-day change"
            value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
            detail={change === null ? "Needs a month of entries" : lb}
          />
        )}
        {body.trackHeight && (
          <StatTile
            label="Height"
            value={latestHeight ? formatHeight(latestHeight.heightCm!, units) : "—"}
            detail={latestHeight ? dayLabel(latestHeight.localDate) : "Not logged yet"}
          />
        )}
        {latestWeight && latestHeight && (
          <StatTile label="BMI" value={bmi(latestWeight.weightKg!, latestHeight.heightCm!)} />
        )}
      </StatGrid>

      <Section title="Log">
        <DateStepper label="Date" value={date} onChange={setDate} max={today} today={today} />
        {/* Keyed by date so the inputs reset to that day's values. */}
        <View key={date} style={{ gap: space.md }}>
          {body.trackWeight && (
            <WeightInput
              kg={onDate?.weightKg ?? null}
              units={units}
              placeholderKg={latestWeight?.weightKg}
              onCommit={(weightKg) => save.mutate({ date, weightKg })}
            />
          )}
          {body.trackHeight && (
            <HeightInput
              cm={onDate?.heightCm ?? null}
              units={units}
              placeholderCm={latestHeight?.heightCm}
              onCommit={(heightCm) => save.mutate({ date, heightCm })}
            />
          )}
        </View>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : ""}
        </Text>
        <ErrorNote error={save.error} />
      </Section>

      {body.trackWeight && weights.length > 0 && (
        <Section title="Weight">
          <TrendChart
            label="Weight"
            unit={lb}
            points={[...weights]
              .reverse()
              .map((e) => ({ date: e.localDate, value: toDisplayWeight(e.weightKg!, units) }))}
          />
        </Section>
      )}

      {body.entries.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Entries</Label>
          <Card style={{ padding: 0 }}>
            {body.entries.slice(0, 60).map((e, i) => (
              <View key={e.localDate} style={[styles.entry, i > 0 && styles.border]}>
                <Pressable onPress={() => setDate(e.localDate)} hitSlop={6} style={{ flex: 1 }}>
                  <Text style={{ color: colors.court300, fontSize: 15 }}>
                    {dayLabel(e.localDate)}
                  </Text>
                </Pressable>
                <Text style={styles.value}>
                  {e.weightKg !== null ? `${toDisplayWeight(e.weightKg, units)} ${lb}` : ""}
                  {e.heightCm !== null ? `  ${formatHeight(e.heightCm, units)}` : ""}
                </Text>
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={`Delete ${dayLabel(e.localDate)}`}
                  onPress={() =>
                    Alert.alert(`Delete ${dayLabel(e.localDate)}?`, undefined, [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          save.mutate({
                            date: e.localDate,
                            ...(e.weightKg !== null && { weightKg: null }),
                            ...(e.heightCm !== null && { heightCm: null }),
                          }),
                      },
                    ])
                  }
                >
                  <Text style={{ color: colors.flare, fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  status: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  value: { color: colors.court100, fontSize: 15, fontVariant: ["tabular-nums"] },
});
