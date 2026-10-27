import type { ObjectiveDto } from "@rlo/shared";
import { StyleSheet, Text, View } from "react-native";
import { formatNumber, shortDate } from "@/lib/format";
import { colors, tierColor } from "@/lib/theme";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "12 days left · On pace", "Reached Oct 23", "Missed · ended Oct 25"… */
export function objectiveStatusText(o: ObjectiveDto): string {
  const p = o.progress;
  switch (p.status) {
    case "completed":
      return `Reached ${shortDate(p.completedOn!)}`;
    case "missed":
      return `Missed · ended ${shortDate(o.endsOn)}`;
    case "upcoming":
      return `Starts ${shortDate(o.startsOn)}`;
    default: {
      const left = p.daysLeft === 0 ? "Due today" : `${plural(p.daysLeft, "day")} left`;
      if (p.onPace) return `${left} · On pace`;
      const remaining = formatNumber(Math.ceil((o.target - p.current) * 10) / 10);
      if (p.daysLeft === 0) return `${left} · ${remaining} ${o.unit} to go`;
      // Today counts, so the remainder spreads over daysLeft + 1 days.
      const perDay = Math.ceil(((o.target - p.current) / (p.daysLeft + 1)) * 10) / 10;
      return `${left} · ${remaining} ${o.unit} to go (${formatNumber(perDay)}/day)`;
    }
  }
}

export function statusColor(o: ObjectiveDto): string {
  const { status, onPace } = o.progress;
  if (status === "completed") return colors.neon;
  if (status === "missed") return colors.flare;
  if (status === "active" && !onPace) return tierColor(65);
  return colors.court300;
}

/** The progress bar, with a tick where an even pace would be by today. */
export function ObjectiveBar({
  objective: o,
  thin = false,
}: {
  objective: ObjectiveDto;
  thin?: boolean;
}) {
  const p = o.progress;
  const pacePct = Math.min(100, (100 * p.expected) / o.target);
  const fill =
    p.status === "completed"
      ? colors.neon
      : p.status === "missed"
        ? colors.flare
        : p.onPace
          ? colors.neon
          : tierColor(65);
  return (
    <View
      style={[styles.track, { height: thin ? 6 : 10 }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${o.name} progress`}
      accessibilityValue={{ min: 0, max: o.target, now: p.current }}
    >
      <View
        style={[
          styles.fill,
          { width: `${p.pct}%`, backgroundColor: fill, opacity: p.status === "missed" ? 0.7 : 1 },
        ]}
      />
      {p.status === "active" && pacePct > 0 && pacePct < 100 && (
        <View style={[styles.pace, { left: `${pacePct}%` }]} />
      )}
    </View>
  );
}

/** "37.5 / 100 miles" */
export function ObjectiveAmount({
  objective: o,
  size = 15,
}: {
  objective: ObjectiveDto;
  size?: number;
}) {
  return (
    <Text style={{ color: colors.court100, fontSize: size, fontVariant: ["tabular-nums"] }}>
      {formatNumber(o.progress.current)}
      <Text style={{ color: colors.court500 }}>
        {" "}
        / {formatNumber(o.target)} {o.unit}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 999, backgroundColor: colors.court700 },
  fill: { height: "100%", borderRadius: 999 },
  pace: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: "rgba(230,237,245,0.7)",
  },
});
