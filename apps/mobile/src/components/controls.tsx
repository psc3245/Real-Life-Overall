import { addDays } from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dayLabel } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { Field } from "./ui";

/** A row of mutually exclusive options (the web's tab lists and selects). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && { color: colors.court950 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A toggleable pill (attribute links, weekdays, habit types). */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  round,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  round?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        round && styles.round,
        selected && styles.chipOn,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.neon }]}>{label}</Text>
    </Pressable>
  );
}

/** A labeled form row. */
export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** A small numeric input; empty means null. */
export function NumberField({
  value,
  onChange,
  label,
  width = 96,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  width?: number;
}) {
  return (
    <Field
      accessibilityLabel={label}
      keyboardType="numbers-and-punctuation"
      value={value === null ? "" : String(value)}
      onChangeText={(t) => {
        const n = Number(t);
        onChange(t.trim() === "" || !Number.isFinite(n) ? null : n);
      }}
      style={{ width }}
    />
  );
}

/** Pick a date a day at a time (no native date picker needed), within optional bounds. */
export function DateStepper({
  value,
  onChange,
  min,
  max,
  today,
  label,
}: {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  today?: string;
  label: string;
}) {
  const step = (by: number) => {
    const next = addDays(value, by);
    if ((min && next < min) || (max && next > max)) return;
    onChange(next);
  };
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Earlier"
        disabled={Boolean(min && value <= min)}
        onPress={() => step(-1)}
        style={[styles.stepButton, min && value <= min ? { opacity: 0.3 } : null]}
      >
        <SymbolView name="chevron.left" tintColor={colors.court100} size={14} />
      </Pressable>
      <Text style={styles.stepDate}>{value === today ? "Today" : dayLabel(value)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Later"
        disabled={Boolean(max && value >= max)}
        onPress={() => step(1)}
        style={[styles.stepButton, max && value >= max ? { opacity: 0.3 } : null]}
      >
        <SymbolView name="chevron.right" tintColor={colors.court100} size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDate: { color: colors.court100, fontSize: 15, minWidth: 104, textAlign: "center" },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  segment: { paddingHorizontal: space.md, paddingVertical: 8 },
  segmentOn: { backgroundColor: colors.neon },
  segmentText: {
    color: colors.court300,
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  round: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { borderColor: colors.neon, backgroundColor: "rgba(60,242,200,0.15)" },
  chipText: { color: colors.court300, fontSize: 14 },
  formLabel: {
    color: colors.court300,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
