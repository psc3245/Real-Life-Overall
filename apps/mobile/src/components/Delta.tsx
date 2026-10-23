import { Text, type TextStyle } from "react-native";
import { colors, fonts, tierColor } from "@/lib/theme";

const up = tierColor(85);
const down = tierColor(0);

/** A signed rating change: green up, red down (as on the web). */
export function Delta({ value, style }: { value: number; style?: TextStyle }) {
  return (
    <Text
      style={[{ fontFamily: fonts.display, fontSize: 15, color: value > 0 ? up : down }, style]}
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value).toFixed(Math.abs(value) < 0.1 ? 2 : 1)}
    </Text>
  );
}

export const deltaColors = { up, down, flat: colors.court300 };
