import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space, tierColor } from "@/lib/theme";

// Like the web: OVR as a whole number, other ratings to one decimal.
const formatOvr = (value: number | null) => (value === null ? "—" : String(Math.round(value)));
const formatRating = (value: number | null) => (value === null ? "—" : value.toFixed(1));

/** The big tier-colored OVR number. */
export function OvrBadge({ value, size = 96 }: { value: number | null; size?: number }) {
  const color = value === null ? colors.court500 : tierColor(value);
  return (
    <View style={[styles.ovr, { borderColor: color, width: size * 1.3, height: size * 1.3 }]}>
      <Text style={[styles.ovrValue, { color, fontSize: size * 0.62 }]}>{formatOvr(value)}</Text>
      <Text style={styles.ovrLabel}>OVR</Text>
    </View>
  );
}

/** A label, a bar that fills on mount, and the value, colored by tier. */
export function StatBar({ label, value }: { label: string; value: number | null }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: value ?? 0,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [fill, value]);
  const color = value === null ? colors.court500 : tierColor(value);

  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.statValue, { color }]}>{formatRating(value)}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
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
  },
  ovrValue: { fontFamily: fonts.heavy, lineHeight: undefined },
  ovrLabel: {
    color: colors.court300,
    fontFamily: fonts.display,
    letterSpacing: 3,
    fontSize: 14,
    marginTop: -6,
  },
  stat: { gap: space.xs },
  statHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  statLabel: { color: colors.court100, fontSize: 15, flexShrink: 1, marginRight: space.sm },
  statValue: { fontFamily: fonts.heavy, fontSize: 20 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.court700, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  trend: { fontFamily: fonts.display, fontSize: 14 },
});
