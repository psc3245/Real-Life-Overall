import type { SeasonMode } from "@rlo/shared";
import { Text, View, type TextStyle } from "react-native";
import { useTalk } from "@/lib/talk";
import { colors, fonts, tierColor } from "@/lib/theme";
import { formatScore, useScore } from "./score";

/** A signed rating change: green up, red down (as on the web). */
export function Delta({ value, style }: { value: number; style?: TextStyle }) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.display,
          fontSize: 15,
          color: value > 0 ? deltaColors.up() : deltaColors.down(),
        },
        style,
      ]}
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value).toFixed(Math.abs(value) < 0.1 ? 2 : 1)}
    </Text>
  );
}

/**
 * One rating change as the season scores it: the change itself, or in a growth season the part
 * that counts (decay and setbacks show as "±0", DESIGN.md §4.6).
 */
export function ChangeDelta({
  delta,
  growth,
  style,
}: {
  delta: number;
  growth: number;
  style?: TextStyle;
}) {
  const { mode } = useScore();
  if (mode !== "growth") return <Delta value={delta} style={style} />;
  if (Math.abs(growth) < 0.005) {
    return (
      <Text
        accessibilityHint="Doesn't count toward growth"
        style={[{ fontFamily: fonts.display, fontSize: 15, color: colors.court500 }, style]}
      >
        ±0
      </Text>
    );
  }
  return <Delta value={growth} style={style} />;
}

/** "OVR 70.1 → 71.2 +1.1", or in a growth season "Growth +3.2 → +4.0 +0.8". */
export function OverallMove({
  mode,
  before,
  after,
}: {
  mode: SeasonMode;
  before: number;
  after: number;
}) {
  const talk = useTalk();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.court300 }}>
        {mode === "growth" ? talk.growthLabel : talk.ovr} {formatScore(mode, before)} →{" "}
        <Text style={{ color: colors.court100 }}>{formatScore(mode, after)}</Text>
      </Text>
      {Math.abs(after - before) >= 0.05 && <Delta value={after - before} />}
    </View>
  );
}

/** Up/down colors follow the player's tier palette, so read them at render time. */
export const deltaColors = {
  up: () => tierColor(85),
  down: () => tierColor(0),
  flat: colors.court300,
};
