import { SEASON_MODE_INFO, SEASON_MODES, type SeasonMode } from "@rlo/shared";
import { Pressable, StyleSheet, Text } from "react-native";
import { useAccount } from "@/api/account";
import { modeName, useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { PremiumBadge } from "./Premium";
import { Muted } from "./ui";

/**
 * Rating, growth or souls, picked at the start of each season (DESIGN.md §4.6, §4.7). Souls is
 * still in testing, so only dev and admin accounts see it.
 */
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
  const { premium, tester } = useAccount();
  return (
    <>
      {SEASON_MODES.filter((m) => m !== "souls" || tester).map((mode) => {
        const active = value === mode;
        // Rating seasons are premium (DESIGN.md §8.9).
        const off = disabled || (mode === "rating" && !premium);
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled: off }}
            disabled={off}
            onPress={() => onChange(mode)}
            style={[styles.option, active && styles.active, off && { opacity: 0.5 }]}
          >
            {mode === "rating" && !premium && <PremiumBadge />}
            <Text style={[styles.title, active && { color: colors.neon }]}>
              {modeName(talk, mode)}
              {mode === "souls" && <Text style={styles.beta}> · Beta</Text>}
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
  beta: { color: colors.court500, fontSize: 13 },
  active: { borderColor: colors.neon, backgroundColor: "rgba(60,242,200,0.08)" },
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
