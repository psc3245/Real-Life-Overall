import { SEASON_MODE_INFO, SEASON_MODES, type SeasonMode } from "@rlo/shared";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { Muted } from "./ui";

/** Rating or growth, picked at the start of each season (DESIGN.md §4.6). */
export function ModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: SeasonMode;
  onChange: (mode: SeasonMode) => void;
  disabled?: boolean;
}) {
  const talk = useTalk();
  return (
    <>
      {SEASON_MODES.map((mode) => {
        const active = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(mode)}
            style={[styles.option, active && styles.active, disabled && { opacity: 0.5 }]}
          >
            <Text style={[styles.title, active && { color: colors.neon }]}>
              {mode === "growth" ? talk.growthMode : talk.ratingMode}
            </Text>
            <Muted style={{ fontSize: 14 }}>{SEASON_MODE_INFO[mode]}</Muted>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  option: {
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
    borderRadius: 14,
    padding: space.lg,
  },
  active: { borderColor: colors.neon, backgroundColor: "rgba(60,242,200,0.08)" },
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
