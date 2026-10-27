import { formatDuration } from "@rlo/shared";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, space } from "@/lib/theme";

const STORAGE_KEY = "rlo.restSeconds";
const DEFAULT_REST = 120;

function storedRest(): number {
  const n = Number(SecureStore.getItem(STORAGE_KEY));
  return Number.isFinite(n) && n >= 15 ? n : DEFAULT_REST;
}

/** A rest countdown started by checking off a set. Its length is remembered on this device. */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [length, setLength] = useState(storedRest);
  return {
    endsAt,
    length,
    start: () => setEndsAt(Date.now() + length * 1000),
    stop: () => setEndsAt(null),
    adjust: (delta: number) => {
      const next = Math.max(15, length + delta);
      setLength(next);
      SecureStore.setItem(STORAGE_KEY, String(next));
      setEndsAt((at) => (at ? at + delta * 1000 : at));
    },
  };
}

/** Floats above the bottom edge while resting. */
export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  const { endsAt, stop } = timer;
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  useEffect(() => {
    if (endsAt && now >= endsAt) stop();
  }, [endsAt, now, stop]);
  if (!endsAt) return null;

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = Math.min(100, (100 * left) / timer.length);
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`Rest timer, ${left} seconds left`}
      style={[styles.bar, { bottom: insets.bottom + space.md }]}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.time}>{formatDuration(left)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: space.xs }}>
          <Step label="−15s" onPress={() => timer.adjust(-15)} />
          <Step label="+15s" onPress={() => timer.adjust(15)} />
          <Pressable onPress={stop} style={[styles.step, styles.skip]} accessibilityRole="button">
            <Text style={[styles.stepText, { color: colors.court950, fontWeight: "700" }]}>
              Skip
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.step} accessibilityRole="button">
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: "rgba(13,17,23,0.97)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  track: { height: 3, backgroundColor: colors.court700 },
  fill: { height: "100%", backgroundColor: colors.neon },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
  },
  label: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  time: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 30 },
  step: {
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    justifyContent: "center",
  },
  skip: { backgroundColor: colors.neon, borderColor: colors.neon },
  stepText: { color: colors.court100, fontSize: 14 },
});
