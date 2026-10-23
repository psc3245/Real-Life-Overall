import {
  formatHabitEntry,
  groupProgress,
  isDayHabitDone,
  type DayHabitDto,
  type HabitEntryValue,
} from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";

type Save = (habitId: string, value: HabitEntryValue) => void;

/** One of today's habits with a quick control for its type; groups list their sub-habits. */
export function HabitRow({
  item,
  editable,
  onSave,
}: {
  item: DayHabitDto;
  editable: boolean;
  onSave: Save;
}) {
  const done = isDayHabitDone(item);
  const { habit } = item;

  if (habit.type === "group") {
    return (
      <View style={styles.group}>
        <View style={styles.row}>
          <DoneMark done={done} />
          <Text style={styles.name}>{habit.name}</Text>
          <Text style={styles.reading}>{groupProgress(item)}</Text>
        </View>
        <View style={styles.children}>
          {(item.children ?? []).map((child) => (
            <HabitRow key={child.habit.id} item={child} editable={editable} onSave={onSave} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <DoneMark done={done} />
      <Text style={styles.name} numberOfLines={2}>
        {habit.name}
      </Text>
      <Control item={item} editable={editable} onSave={onSave} />
    </View>
  );
}

function DoneMark({ done }: { done: boolean }) {
  return (
    <SymbolView
      name={done ? "checkmark.circle.fill" : "circle"}
      tintColor={done ? colors.neon : colors.court500}
      size={22}
    />
  );
}

function Control({
  item,
  editable,
  onSave,
}: {
  item: DayHabitDto;
  editable: boolean;
  onSave: Save;
}) {
  const { habit, entry } = item;
  const { config } = habit;
  const num = entry?.num ?? null;
  const text = entry?.text ?? null;
  const save = (value: HabitEntryValue) => onSave(habit.id, value);
  // Counters and timers read "0/20 pages" before anything is logged, not "—".
  const counted = habit.type === "counter" || habit.type === "duration";
  const shown = entry ?? (counted ? { num: 0, text: null } : null);
  const reading = <Text style={styles.reading}>{formatHabitEntry(habit.type, config, shown)}</Text>;
  if (!editable) return reading;

  switch (habit.type) {
    case "checkbox":
    case "checknote":
      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: num === 1 }}
          hitSlop={12}
          onPress={() => save({ num: num === 1 ? 0 : 1, text })}
          style={[styles.toggle, num === 1 && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, num === 1 && { color: colors.court950 }]}>
            {num === 1 ? "Done" : "Mark"}
          </Text>
        </Pressable>
      );
    case "counter":
    case "duration": {
      const step = habit.type === "duration" ? 5 : 1;
      return (
        <Stepper
          reading={reading}
          onMinus={() => save({ num: Math.max(0, (num ?? 0) - step), text: null })}
          onPlus={() => save({ num: (num ?? 0) + step, text: null })}
        />
      );
    }
    case "slider":
    case "rating": {
      const min = config.min ?? (habit.type === "rating" ? 1 : 0);
      const max = config.max ?? (habit.type === "rating" ? 5 : 10);
      return (
        <Stepper
          reading={reading}
          onMinus={() => save({ num: Math.max(min, (num ?? min + 1) - 1), text: null })}
          onPlus={() => save({ num: Math.min(max, (num ?? min - 1) + 1), text: null })}
        />
      );
    }
    case "shorttext":
      return <ShortText initial={text ?? ""} onSubmit={(t) => save({ num: null, text: t })} />;
    default:
      return reading;
  }
}

function Stepper({
  reading,
  onMinus,
  onPlus,
}: {
  reading: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <StepButton symbol="minus" onPress={onMinus} label="Decrease" />
      {reading}
      <StepButton symbol="plus" onPress={onPlus} label="Increase" />
    </View>
  );
}

function StepButton({
  symbol,
  onPress,
  label,
}: {
  symbol: "minus" | "plus";
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.stepButton}>
      <SymbolView name={symbol} tintColor={colors.neon} size={14} />
    </Pressable>
  );
}

function ShortText({ initial, onSubmit }: { initial: string; onSubmit: (text: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      value={value}
      onChangeText={setValue}
      onEndEditing={() => value !== initial && onSubmit(value.trim())}
      placeholder="Answer"
      placeholderTextColor={colors.court500}
      returnKeyType="done"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  group: { gap: space.xs },
  children: { paddingLeft: space.xl, gap: space.xs },
  name: { color: colors.court100, fontSize: 16, flex: 1 },
  reading: { color: colors.court300, fontFamily: fonts.display, fontSize: 15 },
  toggle: {
    borderColor: colors.neonDim,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  toggleOn: { backgroundColor: colors.neon, borderColor: colors.neon },
  toggleText: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.court800,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minWidth: 120,
    maxWidth: 160,
    color: colors.court100,
    borderBottomColor: colors.court500,
    borderBottomWidth: 1,
    paddingVertical: 4,
    fontSize: 15,
  },
});
