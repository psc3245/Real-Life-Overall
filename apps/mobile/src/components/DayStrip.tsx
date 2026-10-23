import { dayOfWeek, WEEKDAY_LETTERS, type HabitDayStat, type HabitStatRange } from "@rlo/shared";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { shortDate } from "@/lib/format";
import { colors, space, tierColor } from "@/lib/theme";

const red = tierColor(0);

function dayStyle(d: HabitDayStat, today: string): ViewStyle {
  if (d.done) return { borderColor: colors.neon, backgroundColor: colors.neon };
  if (d.future || d.date === today) {
    return d.scheduled
      ? { borderColor: colors.court500, borderStyle: "dashed" }
      : { borderColor: "transparent" };
  }
  if (d.scheduled) return { borderColor: `${red}99`, backgroundColor: `${red}1a` };
  return { borderColor: colors.court800, backgroundColor: "rgba(21,27,36,0.4)" };
}

const dayLabel = (d: HabitDayStat, today: string) =>
  [
    shortDate(d.date),
    d.done
      ? "done"
      : d.future || d.date === today
        ? d.scheduled
          ? "to do"
          : ""
        : d.scheduled
          ? "missed"
          : "off",
    d.value && d.value !== "—" ? d.value : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** Week: seven labeled boxes. Month and season: a compact calendar strip. */
export function DayStrip({
  days,
  range,
  today,
}: {
  days: HabitDayStat[];
  range: HabitStatRange;
  today: string;
}) {
  if (range === "week") {
    return (
      <View style={styles.week}>
        {days.map((d) => (
          <View
            key={d.date}
            style={styles.weekDay}
            accessible
            accessibilityLabel={dayLabel(d, today)}
          >
            <Text style={styles.letter}>{WEEKDAY_LETTERS[dayOfWeek(d.date)]}</Text>
            <View style={[styles.box, dayStyle(d, today)]}>
              {d.done && <Text style={{ color: colors.court950, fontSize: 12 }}>✓</Text>}
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.strip}>
      {days.map((d) => (
        <View
          key={d.date}
          accessible
          accessibilityLabel={dayLabel(d, today)}
          style={[styles.small, dayStyle(d, today)]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row", gap: 6 },
  weekDay: { flex: 1, alignItems: "center", gap: space.xs },
  letter: { color: colors.court500, fontSize: 10 },
  box: {
    alignSelf: "stretch",
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  small: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
});
