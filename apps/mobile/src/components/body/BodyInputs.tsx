import {
  CM_PER_INCH,
  fromDisplayWeight,
  toDisplayWeight,
  weightUnit,
  type UnitSystem,
} from "@rlo/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Field } from "@/components/ui";
import { colors, space } from "@/lib/theme";

/** A weight in the user's unit; commits kg (or null to clear) when editing ends. */
export function WeightInput({
  kg,
  units,
  placeholderKg,
  onCommit,
}: {
  kg: number | null;
  units: UnitSystem;
  placeholderKg?: number | null;
  onCommit: (kg: number | null) => void;
}) {
  const [text, setText] = useState(kg === null ? "" : String(toDisplayWeight(kg, units)));
  const commit = () => {
    const t = text.trim();
    if (!t) return kg !== null && onCommit(null);
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return;
    const next = fromDisplayWeight(n, units);
    if (kg === null || Math.abs(next - kg) > 0.01) onCommit(next);
  };
  return (
    <View style={styles.row}>
      <Field
        accessibilityLabel={`Weight in ${weightUnit(units)}`}
        keyboardType="decimal-pad"
        returnKeyType="done"
        value={text}
        placeholder={placeholderKg ? String(toDisplayWeight(placeholderKg, units)) : "0"}
        onChangeText={setText}
        onEndEditing={commit}
        style={styles.field}
      />
      <Text style={styles.unit}>{weightUnit(units)}</Text>
    </View>
  );
}

/** Height as feet + inches or cm; commits cm (or null) when editing ends. */
export function HeightInput({
  cm,
  units,
  placeholderCm,
  onCommit,
}: {
  cm: number | null;
  units: UnitSystem;
  placeholderCm?: number | null;
  onCommit: (cm: number | null) => void;
}) {
  const totalIn = (v: number | null | undefined) => (v ? Math.round(v / CM_PER_INCH) : null);
  const inches = totalIn(cm);
  const [ft, setFt] = useState(inches === null ? "" : String(Math.floor(inches / 12)));
  const [inch, setInch] = useState(inches === null ? "" : String(inches % 12));
  const [metric, setMetric] = useState(cm === null ? "" : String(Math.round(cm)));
  const hint = totalIn(placeholderCm);

  const commit = (f = ft, i = inch, m = metric) => {
    let next: number | null;
    if (units === "metric") next = m.trim() ? Number(m) : null;
    else
      next = f.trim() || i.trim() ? ((Number(f) || 0) * 12 + (Number(i) || 0)) * CM_PER_INCH : null;
    if (next !== null && (!Number.isFinite(next) || next <= 0)) return;
    if (next === null ? cm !== null : cm === null || Math.abs(next - cm) > 0.5) onCommit(next);
  };

  if (units === "metric") {
    return (
      <View style={styles.row}>
        <Field
          accessibilityLabel="Height in cm"
          keyboardType="number-pad"
          returnKeyType="done"
          value={metric}
          placeholder={placeholderCm ? String(Math.round(placeholderCm)) : "0"}
          onChangeText={setMetric}
          onEndEditing={() => commit()}
          style={styles.field}
        />
        <Text style={styles.unit}>cm</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Field
        accessibilityLabel="Height, feet"
        keyboardType="number-pad"
        returnKeyType="done"
        value={ft}
        placeholder={hint ? String(Math.floor(hint / 12)) : "5"}
        onChangeText={setFt}
        onEndEditing={() => commit()}
        style={[styles.field, { width: 56 }]}
      />
      <Text style={styles.unit}>ft</Text>
      <Field
        accessibilityLabel="Height, inches"
        keyboardType="number-pad"
        returnKeyType="done"
        value={inch}
        placeholder={hint ? String(hint % 12) : "10"}
        onChangeText={setInch}
        onEndEditing={() => commit()}
        style={[styles.field, { width: 56 }]}
      />
      <Text style={styles.unit}>in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  field: { width: 84, textAlign: "right", paddingVertical: 8 },
  unit: { color: colors.court300, fontSize: 15 },
});
