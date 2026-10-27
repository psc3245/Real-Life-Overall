import {
  formatDuration,
  fromDisplayDistance,
  fromDisplayWeight,
  parseDuration,
  toDisplayDistance,
  toDisplayWeight,
  type SetField,
  type UnitSystem,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { colors } from "@/lib/theme";

/** Stored value (kg, m, s or a count) → the text shown in a cell. */
export function displayValue(field: SetField, value: number | null, units: UnitSystem): string {
  if (value === null) return "";
  switch (field) {
    case "weight":
      return String(toDisplayWeight(value, units));
    case "distance":
      return String(toDisplayDistance(value, units));
    case "duration":
      return formatDuration(value);
    default:
      return String(value);
  }
}

/** Cell text → stored value; undefined when it doesn't parse. */
function parseValue(field: SetField, text: string, units: UnitSystem): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (field === "duration") return parseDuration(t) ?? undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (field === "weight") return fromDisplayWeight(n, units);
  if (field === "distance") return fromDisplayDistance(n, units);
  return Math.round(n);
}

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
  useEffect(() => {
    // A value that didn't come from typing here (e.g. copied from "Previous") replaces the text.
    if (value !== emitted.current) {
      emitted.current = value;
      setText(shown);
    }
  }, [value, shown]);

  return (
    <TextInput
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
  );
}

const styles = StyleSheet.create({
  cell: {
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
