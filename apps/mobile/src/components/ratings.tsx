import { TREND_THRESHOLD } from "@rlo/shared";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space, tierColor } from "@/lib/theme";

/** The big tier-colored OVR number (whole numbers, as on the web). */
export function OvrBadge({ value, size = 96 }: { value: number | null; size?: number }) {
  const color = value === null ? colors.court500 : tierColor(value);
  return (
    <View
      style={[
        styles.ovr,
        { borderColor: color, shadowColor: color, width: size * 1.3, height: size * 1.3 },
      ]}
    >
      <Text style={[styles.ovrValue, { color, fontSize: size * 0.62 }]}>
        {value === null ? "—" : Math.round(value)}
      </Text>
      <Text style={[styles.ovrLabel, { fontSize: Math.max(10, size * 0.15) }]}>OVR</Text>
    </View>
  );
}

/** A 2K-style attribute bar that fills on mount, with hot/cold, projection and goal markers. */
export function StatBar({
  label,
  value,
  trend,
  projection,
  goal,
}: {
  label: string;
  value: number | null;
  /** 7-day change; shown as a hot/cold marker past the threshold. */
  trend?: number | null;
  /** Season-end projection, drawn as a ghost bar. */
  projection?: number | null;
  /** The player's target, drawn as a tick on the track. */
  goal?: number | null;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: value ?? 0, duration: 900, useNativeDriver: false }).start();
  }, [fill, value]);
  const color = value === null ? colors.court500 : tierColor(value);
  const hot = trend != null && Math.abs(trend) >= TREND_THRESHOLD ? trend > 0 : null;

  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <View style={styles.statName}>
          <Text style={styles.statLabel} numberOfLines={1}>
            {label}
          </Text>
          {hot !== null && (
            <Text style={[styles.hot, { color: tierColor(hot ? 85 : 0) }]}>
              {hot ? "▲ hot" : "▼ cold"}
            </Text>
          )}
        </View>
        <Text style={[styles.statValue, { color }]}>{value === null ? "—" : value.toFixed(1)}</Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: value ?? 0 }}
      >
        {projection != null && (
          <View
            style={[styles.fill, styles.ghost, { width: `${projection}%`, backgroundColor: color }]}
          />
        )}
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
        {goal != null && <View style={[styles.goal, { left: `${goal}%` }]} />}
      </View>
    </View>
  );
}

/** "+1.2" / "−0.4" for a change, colored up or down. */
export function Trend({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.05) return null;
  const up = value > 0;
  return (
    <Text style={[styles.trend, { color: up ? colors.neon : colors.flare }]}>
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}
    </Text>
  );
}

const styles = StyleSheet.create({
  ovr: {
    borderWidth: 3,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.court900,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  ovrValue: { fontFamily: fonts.heavy },
  ovrLabel: { color: colors.court300, fontFamily: fonts.display, letterSpacing: 3, marginTop: -6 },
  stat: { gap: space.xs },
  statHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  statName: { flexDirection: "row", alignItems: "baseline", gap: space.sm, flexShrink: 1 },
  statLabel: {
    color: colors.court300,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  hot: { fontSize: 12, fontWeight: "700" },
  statValue: { fontFamily: fonts.heavy, fontSize: 22, marginLeft: space.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.court700 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
  ghost: { opacity: 0.25 },
  goal: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: colors.court100,
  },
  trend: { fontFamily: fonts.display, fontSize: 14 },
});
