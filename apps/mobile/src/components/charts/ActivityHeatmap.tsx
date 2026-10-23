import { dayOfWeek, type ActivityDayDto } from "@rlo/shared";
import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { dayLabel } from "@/lib/format";
import { colors, space, tierColor } from "@/lib/theme";
import { Delta } from "../Delta";
import { Card, Muted } from "../ui";

const CELL = 14;
const GAP = 3;
/** One-hue sequential ramp on the dark surface: more rating gained, brighter. */
const LEVELS = [
  colors.court800,
  "rgba(60,242,200,0.25)",
  "rgba(60,242,200,0.5)",
  "rgba(60,242,200,0.75)",
  "rgba(60,242,200,1)",
];

function level(day: ActivityDayDto): number {
  if (!day.logged) return 0;
  if (day.gain >= 2) return 4;
  if (day.gain >= 1) return 3;
  if (day.gain > 0) return 2;
  return 1;
}

/**
 * GitHub-style calendar: one column per week, Sunday at the top. Tapping a day shows its rating
 * change and recap summary, with a link to its log.
 */
export function ActivityHeatmap({ days }: { days: ActivityDayDto[] }) {
  const [selected, setSelected] = useState<ActivityDayDto | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(0);
  if (!days.length) return null;
  const offset = dayOfWeek(days[0]!.date);
  const weeks = Math.ceil((days.length + offset) / 7);
  const logged = days.filter((d) => d.logged).length;
  const grid = { width: weeks * (CELL + GAP), height: 7 * (CELL + GAP) };

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scroller}
          horizontal
          scrollEnabled={grid.width > viewport}
          showsHorizontalScrollIndicator={false}
          // Start at the most recent weeks when there are more than fit.
          onContentSizeChange={(w) => {
            if (viewport && w > viewport) scroller.current?.scrollToEnd({ animated: false });
          }}
        >
          <Svg width={grid.width} height={grid.height}>
            {days.map((day, i) => {
              const slot = i + offset;
              return (
                <Rect
                  key={day.date}
                  x={Math.floor(slot / 7) * (CELL + GAP)}
                  y={(slot % 7) * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={LEVELS[level(day)]}
                  stroke={selected?.date === day.date ? colors.court100 : "none"}
                  strokeWidth={1.5}
                  onPress={() => setSelected(selected?.date === day.date ? null : day)}
                />
              );
            })}
          </Svg>
        </ScrollView>
      </View>
      {selected && <DayCard day={selected} />}
      <View style={styles.caption}>
        <Muted style={styles.small}>
          Logged {logged} of {days.length} days.
        </Muted>
        <View style={styles.legend}>
          <Muted style={styles.small}>Less</Muted>
          {LEVELS.map((c) => (
            <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
          <Muted style={styles.small}>More gained</Muted>
        </View>
      </View>
    </View>
  );
}

function DayCard({ day }: { day: ActivityDayDto }) {
  const net = Math.round((day.gain + day.loss) * 100) / 100;
  return (
    <Card style={{ gap: space.xs, backgroundColor: colors.court950 }}>
      <View style={styles.cardHead}>
        <Text style={styles.cardDate}>{dayLabel(day.date)}</Text>
        {day.gain || day.loss ? <Delta value={net} /> : <Muted>±0</Muted>}
      </View>
      <Muted style={styles.small}>
        {day.logged ? "Logged" : "Nothing logged"}
        {day.recapped && " · recapped"}
        {(day.gain > 0 || day.loss < 0) && (
          <>
            {" · "}
            <Text style={{ color: tierColor(85) }}>+{day.gain.toFixed(1)}</Text>
            {" / "}
            <Text style={{ color: tierColor(0) }}>{day.loss.toFixed(1)}</Text>
          </>
        )}
      </Muted>
      {day.summary && <Muted>{day.summary}</Muted>}
      <Pressable onPress={() => router.push({ pathname: "/log", params: { date: day.date } })}>
        <Text style={{ color: colors.neon, fontSize: 13 }}>Open day →</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: space.sm,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 3 },
  swatch: { width: 11, height: 11, borderRadius: 2 },
  small: { fontSize: 12, color: colors.court500 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardDate: { color: colors.court100, fontWeight: "600", fontSize: 15, textTransform: "uppercase" },
});
