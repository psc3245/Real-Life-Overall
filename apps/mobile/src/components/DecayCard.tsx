import { addDays, BACKFILL_DAYS, MAX_PAUSE_REASON, type PauseDto } from "@rlo/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useCreatePause, useEndPause, usePauses, useRunScheduled } from "@/api/pauses";
import { colors, space, tierColor } from "@/lib/theme";
import { Chip, DateStepper, FormRow } from "./controls";
import { Body, Button, Card, ErrorNote, Field, Muted, Section } from "./ui";

function describe(p: PauseDto) {
  return `${p.startsOn} → ${p.endsOn ?? "until you end it"}${p.reason ? ` · ${p.reason}` : ""}`;
}

/** Explains decay and manages vacation/injury pauses (DESIGN.md §5.4). */
export function DecayCard() {
  const today = useDay(null).data?.today;
  const pauses = usePauses();
  const create = useCreatePause();
  const end = useEndPause();
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  if (!today || !pauses.data) return null;

  const active = pauses.data.find(
    (p) => p.startsOn <= today && (p.endsOn === null || today <= p.endsOn),
  );
  const upcoming = pauses.data.filter((p) => p.startsOn > today);
  const start = startsOn ?? today;

  const submit = () =>
    create.mutate(
      { startsOn: start, endsOn: endsOn && endsOn >= start ? endsOn : null, reason: reason.trim() },
      {
        onSuccess: () => {
          setStartsOn(null);
          setEndsOn(null);
          setReason("");
        },
      },
    );

  return (
    <Section title="Decay & pauses">
      <Muted>
        Attributes fade when you go too long without activity: tap one to see its rule. Pause decay
        while you&apos;re on vacation, sick or injured.
      </Muted>

      {active ? (
        <Card style={styles.active}>
          <Body>
            <Text style={{ color: tierColor(75), fontWeight: "700" }}>Decay paused</Text> ·{" "}
            {describe(active)}
          </Body>
          <Button
            title={end.isPending ? "Ending…" : "End pause"}
            variant="ghost"
            disabled={end.isPending}
            // Ending today means today counts again; a pause that started today disappears.
            onPress={() => end.mutate({ id: active.id, endsOn: addDays(today, -1) })}
          />
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
          <FormRow label="From">
            <DateStepper
              label="Pause from"
              value={start}
              today={today}
              min={addDays(today, -BACKFILL_DAYS)}
              onChange={setStartsOn}
            />
          </FormRow>
          <FormRow label="To">
            <View style={{ gap: space.sm }}>
              <Chip
                label={endsOn ? "Ends on a date" : "Until I end it"}
                selected={endsOn !== null}
                onPress={() => setEndsOn(endsOn ? null : addDays(start, 6))}
              />
              {endsOn && (
                <DateStepper
                  label="Pause until"
                  value={endsOn < start ? start : endsOn}
                  today={today}
                  min={start}
                  onChange={setEndsOn}
                />
              )}
            </View>
          </FormRow>
          <FormRow label="Reason">
            <Field
              value={reason}
              maxLength={MAX_PAUSE_REASON}
              placeholder="Vacation"
              onChangeText={setReason}
            />
          </FormRow>
          <Button
            title={create.isPending ? "Pausing…" : "Pause decay"}
            disabled={create.isPending}
            onPress={submit}
          />
        </View>
      )}

      {upcoming.map((p) => (
        <View key={p.id} style={styles.upcoming}>
          <Muted style={{ flex: 1 }}>Upcoming: {describe(p)}</Muted>
          <Button
            title="Cancel"
            variant="ghost"
            disabled={end.isPending}
            onPress={() => end.mutate({ id: p.id, endsOn: addDays(p.startsOn, -1) })}
          />
        </View>
      ))}
      <ErrorNote error={create.error ?? end.error} />
      {__DEV__ && <DevScheduler />}
    </Section>
  );
}

function DevScheduler() {
  const run = useRunScheduled();
  return (
    <View style={styles.dev}>
      <Muted style={{ fontSize: 12 }}>DEV</Muted>
      <Button
        title={run.isPending ? "Running…" : "Run 4am job now"}
        variant="ghost"
        disabled={run.isPending}
        onPress={() => run.mutate()}
      />
      {run.data && (
        <Muted style={{ fontSize: 12 }}>
          Recapped {run.data.recapped.length ? run.data.recapped.join(", ") : "nothing"} · decayed{" "}
          {run.data.decayDays} day{run.data.decayDays === 1 ? "" : "s"}
          {run.data.failed.length > 0 && ` · failed ${run.data.failed.join(", ")}`}
        </Muted>
      )}
      <ErrorNote error={run.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  active: { gap: space.md, borderColor: tierColor(75) },
  upcoming: { flexDirection: "row", alignItems: "center", gap: space.md },
  dev: {
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.court700,
    borderStyle: "dashed",
    paddingTop: space.md,
  },
});
