import { growthDelta, type ChangeFeedItemDto } from "@rlo/shared";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChangeSource } from "@/api/ratings";
import { dayLabel } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { ChangeDelta } from "./Delta";
import { Card, Muted } from "./ui";

export const SOURCE_LABEL: Record<ChangeSource, string> = {
  onboarding: "Scouting",
  daily_recap: "Recap",
  weekly_review: "Weekly",
  decay: "Decay",
  recalibration: "New season",
};

/** Rows of rating changes; each links to its attribute (and, with `showDates`, its day). */
export function ChangeList({
  items,
  showDates = false,
}: {
  items: ChangeFeedItemDto[];
  showDates?: boolean;
}) {
  return (
    <Card style={{ padding: 0 }}>
      {items.map((c, i) => (
        <View key={c.id} style={[styles.row, i > 0 && styles.border]}>
          <ChangeDelta
            delta={c.delta}
            growth={growthDelta(c)}
            style={{ width: 52, fontSize: 18 }}
          />
          <View style={{ flex: 1 }}>
            <Link href={{ pathname: "/node/[id]", params: { id: c.nodeId } }} style={styles.name}>
              {c.nodeName}
            </Link>
            <Muted>{c.reason}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.source}>{SOURCE_LABEL[c.source]}</Text>
            {showDates && c.date && (
              <Pressable
                hitSlop={6}
                onPress={() => router.push({ pathname: "/log", params: { date: c.date! } })}
              >
                <Text style={styles.date}>{dayLabel(c.date)}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  name: { color: colors.court100, fontSize: 16, fontWeight: "600" },
  source: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  date: { color: colors.court300, fontSize: 12, marginTop: 2 },
});
