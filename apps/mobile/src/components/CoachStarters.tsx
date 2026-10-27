import { COACH_STARTERS } from "@rlo/shared";
import { View } from "react-native";
import { space } from "@/lib/theme";
import { Chip } from "./controls";

/** Starter questions for the coach (chat and Today's card). */
export function Starters({
  onPick,
  disabled = false,
}: {
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
      {COACH_STARTERS.map((s) => (
        <Chip key={s} label={s} selected={false} disabled={disabled} onPress={() => onPick(s)} />
      ))}
    </View>
  );
}
