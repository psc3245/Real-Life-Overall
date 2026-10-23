import {
  MAX_HABIT_JOURNAL,
  MAX_HABIT_NOTE,
  MAX_HABIT_SHORT_TEXT,
  type HabitDto,
  type HabitEntryValue,
} from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { Field } from "./ui";

interface Props {
  habit: HabitDto;
  entry: HabitEntryValue | null;
  disabled: boolean;
  onSave: (value: HabitEntryValue) => void;
}

const DEBOUNCE_MS = 500;

/** Debounces rapid changes (stepper taps) into one save. */
function useDebouncedSave(onSave: Props["onSave"]) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (value: HabitEntryValue) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(value), DEBOUNCE_MS);
  };
}

/** The control for logging one habit, by type (mirrors the web's HabitEntryInput). */
export function HabitEntryInput({ habit, entry, disabled, onSave }: Props) {
  const [num, setNum] = useState<number | null>(entry?.num ?? null);
  const [text, setText] = useState(entry?.text ?? "");
  const debounced = useDebouncedSave(onSave);
  const { config } = habit;

  switch (habit.type) {
    case "checkbox":
    case "checknote": {
      const done = num === 1;
      return (
        <View style={styles.column}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done, disabled }}
            accessibilityLabel={`${habit.name} done`}
            disabled={disabled}
            hitSlop={8}
            onPress={() => {
              const next = done ? null : 1;
              setNum(next);
              onSave({ num: next, text: next === null ? null : text || null });
            }}
            style={[styles.check, done && styles.checkOn]}
          >
            {done && <SymbolView name="checkmark" tintColor={colors.court950} size={18} />}
          </Pressable>
          {habit.type === "checknote" && done && (
            <Field
              value={text}
              maxLength={MAX_HABIT_NOTE}
              editable={!disabled}
              placeholder="Add a note"
              onChangeText={setText}
              onEndEditing={() =>
                text !== (entry?.text ?? "") && onSave({ num: 1, text: text || null })
              }
              style={styles.note}
            />
          )}
        </View>
      );
    }

    case "counter":
    case "duration": {
      const step = habit.type === "duration" ? 15 : 1;
      const unit = habit.type === "duration" ? "min" : config.unit;
      const set = (n: number) => {
        const next = Math.max(0, n);
        setNum(next);
        debounced({ num: next, text: null });
      };
      const value = num ?? 0;
      return (
        <View style={styles.row}>
          <Step
            symbol="minus"
            disabled={disabled || value <= 0}
            onPress={() => set(value - step)}
          />
          <Field
            accessibilityLabel={`${habit.name} amount`}
            keyboardType="number-pad"
            value={num === null ? "" : String(num)}
            editable={!disabled}
            placeholder="0"
            onChangeText={(t) => {
              const n = Number(t);
              if (t !== "" && Number.isFinite(n)) set(Math.round(n));
              else {
                setNum(null);
                debounced({ num: null, text: null });
              }
            }}
            style={styles.amount}
          />
          <Step symbol="plus" disabled={disabled} onPress={() => set(value + step)} />
          <Text style={styles.unit}>
            / {config.target} {unit}
          </Text>
        </View>
      );
    }

    case "slider": {
      // A row of steps instead of a native slider: scales here are short (0–10 by default).
      const min = config.min ?? 0;
      const max = config.max ?? 10;
      if (max - min > 20) {
        const set = (n: number) => {
          const next = Math.min(max, Math.max(min, n));
          setNum(next);
          debounced({ num: next, text: null });
        };
        const value = num ?? Math.round((min + max) / 2);
        return (
          <View style={styles.row}>
            <Step
              symbol="minus"
              disabled={disabled || value <= min}
              onPress={() => set(value - 1)}
            />
            <Text style={styles.scaleValue}>{num ?? "–"}</Text>
            <Step
              symbol="plus"
              disabled={disabled || value >= max}
              onPress={() => set(value + 1)}
            />
            <Text style={styles.unit}>
              {min}–{max}
            </Text>
          </View>
        );
      }
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <View style={styles.scale} accessibilityLabel={habit.name}>
          {steps.map((n) => {
            const on = num !== null && n <= num;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ checked: num === n }}
                accessibilityLabel={String(n)}
                disabled={disabled}
                onPress={() => {
                  const next = num === n ? null : n;
                  setNum(next);
                  onSave({ num: next, text: null });
                }}
                style={[styles.scaleStep, on && styles.scaleOn]}
              >
                <Text style={[styles.scaleText, on && { color: colors.court950 }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    case "rating":
      return (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={habit.name}>
          {Array.from({ length: config.max ?? 5 }, (_, i) => i + 1).map((star) => (
            <Pressable
              key={star}
              accessibilityRole="radio"
              accessibilityState={{ checked: num === star }}
              accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
              disabled={disabled}
              hitSlop={4}
              onPress={() => {
                const next = num === star ? null : star;
                setNum(next);
                onSave({ num: next, text: null });
              }}
            >
              <SymbolView
                name={num !== null && star <= num ? "star.fill" : "star"}
                tintColor={num !== null && star <= num ? tierColor(75) : colors.court500}
                size={26}
              />
            </Pressable>
          ))}
        </View>
      );

    case "shorttext":
    case "journal": {
      const journal = habit.type === "journal";
      return (
        <Field
          accessibilityLabel={habit.name}
          value={text}
          maxLength={journal ? MAX_HABIT_JOURNAL : MAX_HABIT_SHORT_TEXT}
          editable={!disabled}
          multiline={journal}
          placeholder={journal ? "Write it down…" : "Answer…"}
          onChangeText={setText}
          onEndEditing={() =>
            text !== (entry?.text ?? "") && onSave({ num: null, text: text || null })
          }
          style={journal ? { minHeight: 90 } : undefined}
        />
      );
    }

    default:
      return null;
  }
}

function Step({
  symbol,
  disabled,
  onPress,
}: {
  symbol: "minus" | "plus";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={symbol === "plus" ? "Increase" : "Decrease"}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={[styles.step, disabled && { opacity: 0.4 }]}
    >
      <SymbolView name={symbol} tintColor={colors.neon} size={15} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.sm, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  check: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.court500,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.neon, borderColor: colors.neon },
  note: { alignSelf: "stretch", fontSize: 15, paddingVertical: 8 },
  step: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: { width: 64, textAlign: "center", paddingVertical: 7 },
  unit: { color: colors.court300, fontSize: 14 },
  scale: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  scaleStep: {
    minWidth: 28,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.court800,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  scaleOn: { backgroundColor: colors.neon },
  scaleValue: {
    color: colors.neon,
    fontFamily: fonts.heavy,
    fontSize: 20,
    minWidth: 36,
    textAlign: "center",
  },
  scaleText: { color: colors.court100, fontFamily: fonts.display, fontSize: 15 },
});
