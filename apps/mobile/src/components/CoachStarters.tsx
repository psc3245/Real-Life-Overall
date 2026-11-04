import { COACH_STARTERS } from "@rlo/shared";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, space } from "@/lib/theme";

/**
 * Starter questions for the coach (chat and Today's card): one row of pills that scrolls sideways.
 * A wrapping row let long labels grow each pill to the full width, so every pill stays one line.
 */
export function Starters({
  onPick,
  disabled = false,
  inset = 0,
}: {
  onPick: (text: string) => void;
  disabled?: boolean;
  /** Horizontal padding of the parent, so the row can scroll edge to edge. */
  inset?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ marginHorizontal: -inset, flexGrow: 0 }}
      contentContainerStyle={{ gap: space.xs, paddingHorizontal: inset }}
    >
      {COACH_STARTERS.map((s) => (
        <Pressable
          key={s}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onPick(s)}
          style={({ pressed }) => [
            styles.pill,
            pressed && { borderColor: colors.neon },
            disabled && { opacity: 0.4 },
          ]}
        >
          <Text numberOfLines={1} style={styles.text}>
            {s}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  text: { color: colors.court300, fontSize: 14 },
});
