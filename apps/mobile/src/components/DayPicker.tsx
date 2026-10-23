import { addDays, dayOfWeek, MAX_HISTORY_DAYS, WEEKDAY_LETTERS } from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useActivity } from "@/api/ratings";
import { monthYear } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { Button, Muted } from "./ui";

const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const shiftMonth = (start: string, by: number) => {
  const [y, m] = start.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10);
};

/**
 * A calendar button that opens a month sheet; picking a day calls `onPick`. Days you logged are
 * marked, recapped ones filled (as on the web).
 */
export function DayPicker({
  today,
  selected,
  onPick,
}: {
  today: string;
  selected?: string;
  onPick: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthStart(selected ?? today));
  const activity = useActivity(MAX_HISTORY_DAYS);

  const byDate = new Map((activity.data ?? []).map((a) => [a.date, a]));
  const lead = dayOfWeek(month);
  const nextMonth = shiftMonth(month, 1);
  const days: string[] = [];
  for (let d = month; d < nextMonth; d = addDays(d, 1)) days.push(d);

  const pick = (date: string) => {
    setOpen(false);
    onPick(date);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pick a day"
        hitSlop={8}
        onPress={() => {
          setMonth(monthStart(selected ?? today));
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <SymbolView name="calendar" tintColor={colors.neon} size={20} />
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.monthRow}>
            <MonthButton symbol="chevron.left" onPress={() => setMonth(shiftMonth(month, -1))} />
            <Text style={styles.month}>{monthYear(month)}</Text>
            <MonthButton
              symbol="chevron.right"
              disabled={nextMonth > today}
              onPress={() => setMonth(nextMonth)}
            />
          </View>
          <View style={styles.grid}>
            {WEEKDAY_LETTERS.map((w, i) => (
              <Text key={i} style={[styles.cell, styles.weekday]}>
                {w}
              </Text>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <View key={`pad-${i}`} style={styles.cell} />
            ))}
            {days.map((d) => {
              const a = byDate.get(d);
              const isSelected = d === selected;
              return (
                <Pressable
                  key={d}
                  disabled={d > today}
                  onPress={() => pick(d)}
                  accessibilityLabel={`${d}${a?.recapped ? ", recapped" : a?.logged ? ", logged" : ""}`}
                  style={[
                    styles.cell,
                    styles.day,
                    isSelected && { backgroundColor: colors.neon },
                    d === today && !isSelected && styles.today,
                    d > today && { opacity: 0.25 },
                  ]}
                >
                  <Text style={[styles.dayText, isSelected && { color: colors.court950 }]}>
                    {Number(d.slice(8))}
                  </Text>
                  {a?.logged && (
                    <View
                      style={[
                        styles.dot,
                        { borderColor: isSelected ? colors.court950 : colors.neon },
                        a.recapped && {
                          backgroundColor: isSelected ? colors.court950 : colors.neon,
                        },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Muted>○ logged · ● recapped</Muted>
          <View style={{ gap: space.sm }}>
            <Button title="Today" onPress={() => pick(today)} />
            <Button title="Close" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function MonthButton({
  symbol,
  disabled,
  onPress,
}: {
  symbol: "chevron.left" | "chevron.right";
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={symbol === "chevron.left" ? "Previous month" : "Next month"}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={[styles.monthButton, disabled && { opacity: 0.3 }]}
    >
      <SymbolView name={symbol} tintColor={colors.court100} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { flex: 1, backgroundColor: colors.court950, padding: space.xl, gap: space.lg },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center" },
  weekday: { color: colors.court500, fontSize: 12, height: 24, textAlign: "center" },
  day: { borderRadius: 10 },
  today: { borderWidth: 1, borderColor: colors.neon },
  dayText: { color: colors.court100, fontSize: 16 },
  dot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, marginTop: 2 },
});
