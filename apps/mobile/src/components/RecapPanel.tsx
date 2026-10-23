import { MAX_RECAPS_PER_DAY, type DayDto, type RecapDto } from "@rlo/shared";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEndDay } from "@/api/days";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { EarnedBadges } from "./badges";
import { Delta } from "./Delta";
import { Body, Button, Card, ErrorNote, Label, Muted } from "./ui";

const WORKING = ["Reading your day…", "Weighing the evidence…", "Updating your ratings…"];

function hasContent(day: DayDto) {
  return (
    day.journal.trim() !== "" ||
    day.habits.some((h) => h.entry) ||
    day.prompts.some((p) => p.answer?.trim())
  );
}

/** "End my day" before a recap; the recap itself after, with an update button if stale. */
export function RecapPanel({ day }: { day: DayDto }) {
  const endDay = useEndDay(day.date);
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!endDay.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING.length), 2500);
    return () => clearInterval(timer);
  }, [endDay.isPending]);

  const ready = hasContent(day);
  const action = (label: string) => (
    <View style={{ gap: space.sm }}>
      <Button
        title={endDay.isPending ? WORKING[line]! : label}
        disabled={!ready || !day.editable || endDay.isPending}
        onPress={() => endDay.mutate()}
      />
      {!ready && <Muted>Log something first.</Muted>}
      <ErrorNote error={endDay.error} />
    </View>
  );

  if (!day.recap) {
    return (
      <Card style={{ gap: space.md }}>
        <Label>Recap</Label>
        <Muted>
          When you&apos;re done for the day, the scout reviews what you logged and moves your
          ratings.
        </Muted>
        {day.editable ? action("End my day") : <Muted>Not recapped.</Muted>}
      </Card>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {day.status === "stale" && day.editable && (
        <Card style={styles.stale}>
          <Body>
            You&apos;ve changed this day since its recap. Update it to re-score the day (up to{" "}
            {MAX_RECAPS_PER_DAY} recaps per day).
          </Body>
          {action("Update recap")}
        </Card>
      )}
      <RecapCard recap={day.recap} />
    </View>
  );
}

/** A day's recap: narrative, badges, every rating change and the scout's notes. */
export function RecapCard({ recap }: { recap: RecapDto }) {
  const { overallBefore: before, overallAfter: after } = recap;
  return (
    <Card style={styles.recap}>
      <View style={styles.head}>
        <Text style={styles.title}>Day recap</Text>
        <OvrChange before={before} after={after} />
      </View>
      <Body>{recap.narrative}</Body>
      <EarnedBadges badges={recap.badges} />
      {recap.changes.length > 0 ? (
        <View>
          {recap.changes.map((c) => (
            <View key={c.nodeId} style={styles.change}>
              <Delta value={c.delta} style={styles.changeDelta} />
              <View style={{ flex: 1 }}>
                <Text>
                  <Link
                    href={{ pathname: "/node/[id]", params: { id: c.nodeId } }}
                    style={styles.changeName}
                  >
                    {c.nodeName}
                  </Link>
                  <Text style={styles.changeAfter}> → {c.valueAfter.toFixed(1)}</Text>
                </Text>
                <Muted>{c.reason}</Muted>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Muted>No rating changes from this day.</Muted>
      )}
      {recap.flags.length > 0 && (
        <View style={styles.flags}>
          <Label>Scout&apos;s notes</Label>
          {recap.flags.map((f) => (
            <Muted key={f}>• {f}</Muted>
          ))}
        </View>
      )}
    </Card>
  );
}

/** "OVR 56.8 → 57.1 +0.3" */
export function OvrChange({ before, after }: { before: number | null; after: number | null }) {
  if (before === null || after === null) return null;
  return (
    <Text style={styles.ovr}>
      OVR {before.toFixed(1)} → <Text style={{ color: colors.court100 }}>{after.toFixed(1)}</Text>{" "}
      {Math.abs(after - before) >= 0.05 && <Delta value={after - before} />}
    </Text>
  );
}

const styles = StyleSheet.create({
  stale: {
    gap: space.md,
    borderColor: tierColor(75),
    backgroundColor: "rgba(232,227,55,0.05)",
  },
  recap: { gap: space.md, borderColor: "rgba(60,242,200,0.4)" },
  head: { gap: space.xs },
  title: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  ovr: { color: colors.court300, fontFamily: fonts.display, fontSize: 16 },
  change: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
  },
  changeDelta: { width: 52, fontSize: 18 },
  changeName: { color: colors.court100, fontSize: 16, fontWeight: "600" },
  changeAfter: { color: colors.court500, fontSize: 14 },
  flags: {
    gap: space.xs,
    backgroundColor: colors.court950,
    borderRadius: 8,
    padding: space.md,
  },
});
