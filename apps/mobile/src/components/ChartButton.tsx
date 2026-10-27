import type { ChartConfig } from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useFeature } from "@/api/preferences";
import { chartParams } from "@/lib/chartModel";
import { colors } from "@/lib/theme";

/** Opens the chart explorer with these metrics (hidden while Charts is switched off). */
export function ChartButton({
  ids,
  config,
  label = "Chart →",
}: {
  ids: string[];
  config?: Partial<ChartConfig>;
  label?: string;
}) {
  if (!useFeature("charts")) return null;
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={6}
      onPress={() => router.push({ pathname: "/charts", params: chartParams(ids, config) })}
    >
      <Text style={{ color: colors.neon, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
