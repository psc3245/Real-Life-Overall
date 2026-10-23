import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

const styles = StyleSheet.create({
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
