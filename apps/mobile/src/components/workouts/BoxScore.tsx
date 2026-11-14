import {
  BOX_SCORE_FIELDS,
  BOX_SCORE_LABELS,
  hasBoxScore,
  trainingLoad,
  type BoxScoreDto,
  type BoxScoreField,
} from "@rlo/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences, useSetPreferences } from "@/api/preferences";
import { FormRow } from "@/components/controls";
import { SettingsGroup, ToggleRow } from "@/components/settings";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Field } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, space } from "@/lib/theme";

/** 1–3 easy, 4–6 steady, 7–8 hard, 9–10 all out. */
export function effortLabel(effort: number) {
  if (effort <= 3) return "Easy";
  if (effort <= 6) return "Steady";
  if (effort <= 8) return "Hard";
  return "All out";
}

/** Effort 1-10 as a row of cells; tapping the picked one clears it. */
export function EffortPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (effort: number | null) => void;
}) {
  return (
    <FormRow label={value === null ? "Effort" : `Effort: ${value}/10 · ${effortLabel(value)}`}>
      <View style={styles.effort}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = value !== null && n <= value;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Effort ${n}`}
              accessibilityState={{ selected: value === n }}
              onPress={() => {
                onChange(value === n ? null : n);
                haptics.tap();
              }}
              style={[styles.effortCell, on && { backgroundColor: colors.neon }]}
            >
              <Text style={[styles.effortText, on && { color: colors.court950 }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </FormRow>
  );
}

const PLACEHOLDERS: Record<Exclude<BoxScoreField, "effort">, string> = {
  avgHeartRate: "bpm",
  maxHeartRate: "bpm",
  calories: "kcal",
};

/** Whole numbers only; empty is null. */
const whole = (text: string) => {
  const n = Number(text.trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** The box score's inputs, limited to the fields the player asks for (settings). */
export function BoxScoreFields({
  value,
  fields,
  onChange,
}: {
  value: BoxScoreDto;
  fields: readonly BoxScoreField[];
  onChange: (next: BoxScoreDto) => void;
}) {
  const numbers = fields.filter((f): f is Exclude<BoxScoreField, "effort"> => f !== "effort");
  return (
    <View style={{ gap: space.md }}>
      {numbers.length > 0 && (
        <View style={styles.row}>
          {numbers.map((f) => (
            <View key={f} style={{ flex: 1 }}>
              <FormRow label={BOX_SCORE_LABELS[f]}>
                <Field
                  accessibilityLabel={BOX_SCORE_LABELS[f]}
                  value={value[f]?.toString() ?? ""}
                  placeholder={PLACEHOLDERS[f]}
                  keyboardType="number-pad"
                  onChangeText={(t) => onChange({ ...value, [f]: whole(t) })}
                />
              </FormRow>
            </View>
          ))}
        </View>
      )}
      {fields.includes("effort") && (
        <EffortPicker value={value.effort} onChange={(effort) => onChange({ ...value, effort })} />
      )}
    </View>
  );
}

/** A finished workout's box score as stat tiles, with its training load; nothing when empty. */
export function BoxScoreTiles({ box, durationS }: { box: BoxScoreDto | null; durationS: number }) {
  if (!hasBoxScore(box)) return null;
  const load = trainingLoad(box.effort, durationS);
  return (
    <StatGrid>
      {box.avgHeartRate ? <StatTile label="Avg HR" value={box.avgHeartRate} /> : null}
      {box.maxHeartRate ? <StatTile label="Max HR" value={box.maxHeartRate} /> : null}
      {box.calories ? <StatTile label="Calories" value={box.calories} /> : null}
      {box.effort ? (
        <StatTile label="Effort" value={`${box.effort}/10`} detail={effortLabel(box.effort)} />
      ) : null}
      {load !== null ? (
        <StatTile label="Training load" value={load} detail="Effort × minutes" />
      ) : null}
    </StatGrid>
  );
}

const DETAILS: Record<BoxScoreField, string> = {
  avgHeartRate: "From a watch or chest strap.",
  maxHeartRate: "Your peak for the session.",
  calories: "Active calories, from a watch or machine.",
  effort: "1-10, how hard it felt. Effort × minutes is your training load, which you can chart.",
};

/** Settings: what the box score asks for after a workout; nothing switched on skips it. */
export function BoxScoreSettings() {
  const asked = usePreferences().boxScore;
  const set = useSetPreferences();
  return (
    <SettingsGroup
      title="Box score"
      footer="Asked when you finish a workout, all optional. Cardio sessions always have these fields."
    >
      {BOX_SCORE_FIELDS.map((f, i) => (
        <ToggleRow
          key={f}
          value={asked.includes(f)}
          // Keep the usual order whatever order they were switched on in.
          onChange={(on) =>
            set({ boxScore: BOX_SCORE_FIELDS.filter((x) => (x === f ? on : asked.includes(x))) })
          }
          label={BOX_SCORE_LABELS[f]}
          detail={DETAILS[f]}
          last={i === BOX_SCORE_FIELDS.length - 1}
        />
      ))}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  effort: { flexDirection: "row", gap: 4 },
  effortCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.court800,
  },
  effortText: { color: colors.court300, fontSize: 14, fontVariant: ["tabular-nums"] },
});
