import { displaySetValue, parseSetValue, type SetField, type UnitSystem } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputInstance } from "react-native";
import { colors } from "@/lib/theme";

export const displayValue = displaySetValue;
const parseValue = parseSetValue;

/**
 * One editable number in the set table. It keeps its own text while typing (so "13" on the way
 * to "135" isn't converted and rounded back) and resyncs when the stored value changes elsewhere.
 */
export function SetCell({
  field,
  value,
  units,
  placeholder,
  label,
  onChange,
}: {
  field: SetField;
  value: number | null;
  units: UnitSystem;
  placeholder?: string;
  label: string;
  onChange: (value: number | null) => void;
}) {
  const shown = displayValue(field, value, units);
  const [text, setText] = useState(shown);
  const emitted = useRef(value);
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    // A value that didn't come from typing here (e.g. copied from "Previous") replaces the text.
    if (value !== emitted.current) {
      emitted.current = value;
      setText(shown);
    }
  }, [value, shown]);

  // Touches land on the Pressable, which focuses the field: a text field keeps its touches
  // natively, so a swipe starting on it would never reach the row's swipe-to-delete.
  return (
    <Pressable style={styles.wrap} accessible={false} onPress={() => input.current?.focus()}>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        keyboardType={
          field === "duration"
            ? "numbers-and-punctuation"
            : field === "reps" || field === "attempts"
              ? "number-pad"
              : "decimal-pad"
        }
        keyboardAppearance="dark"
        returnKeyType="done"
        selectTextOnFocus
        value={text}
        placeholder={placeholder ?? (field === "duration" ? "m:ss" : "")}
        placeholderTextColor={colors.court500}
        onChangeText={(t) => {
          setText(t);
          const parsed = parseValue(field, t, units);
          if (parsed !== undefined) {
            emitted.current = parsed;
            onChange(parsed);
          }
        }}
        style={styles.cell}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  cell: {
    pointerEvents: "none",
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.court800,
    borderRadius: 7,
    color: colors.court100,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
});
