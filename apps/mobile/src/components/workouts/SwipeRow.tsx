import { useRef, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/lib/theme";

const REVEAL = 76;

/**
 * A row that slides left to show Delete. A short swipe leaves the button showing; a long one
 * deletes straight away.
 */
export function SwipeRow({
  onDelete,
  label,
  style,
  children,
}: {
  onDelete: () => void;
  /** Read by VoiceOver, which deletes through an action instead of the swipe. */
  label: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(0);
  const opened = useRef(false);
  const latest = useRef(onDelete);
  latest.current = onDelete;

  const settle = (to: number) => {
    opened.current = to !== 0;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0 }).start();
  };
  const remove = () =>
    Animated.timing(x, { toValue: -width.current, duration: 160, useNativeDriver: true }).start(
      () => {
        // The row is keyed by position, so the next set slides into this one: reset it.
        opened.current = false;
        x.setValue(0);
        latest.current();
      },
    );

  const pan = useRef(
    PanResponder.create({
      // Only clearly sideways drags; taps and vertical scrolls go to the cells and the list.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > 2 * Math.abs(g.dy) && (g.dx < 0 || opened.current),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const base = opened.current ? -REVEAL : 0;
        x.setValue(Math.min(0, base + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        const at = (opened.current ? -REVEAL : 0) + g.dx;
        if (at < -width.current * 0.5 || g.vx < -1.2) remove();
        else settle(at < -REVEAL / 2 ? -REVEAL : 0);
      },
      onPanResponderTerminate: () => settle(0),
    }),
  ).current;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      accessibilityActions={[{ name: "delete", label: `Delete ${label}` }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onDelete()}
    >
      <Pressable
        onPress={remove}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${label}`}
        style={styles.delete}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.front, { transform: [{ translateX: x }] }]}
      >
        {/* An opaque layer under the row's own (possibly see-through) background. */}
        <View style={style}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, overflow: "hidden" },
  delete: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.flare,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
  },
  deleteText: { color: colors.court950, fontWeight: "700", fontSize: 14 },
  front: { backgroundColor: colors.court900 },
});
