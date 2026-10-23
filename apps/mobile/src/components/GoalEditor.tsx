import type { RatedNodeDto } from "@rlo/shared";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSetGoal } from "@/api/ratings";
import { colors, space } from "@/lib/theme";
import { ErrorNote } from "./ui";

/** Set or clear a node's goal rating (an iOS prompt); shows the season-end projection beside it. */
export function GoalEditor({ node }: { node: RatedNodeDto }) {
  const setGoal = useSetGoal();

  const edit = () =>
    Alert.prompt(
      `Goal for ${node.name}`,
      "A rating from 0 to 100 to aim for this season.",
      [
        { text: "Cancel", style: "cancel" },
        ...(node.goal != null
          ? [
              {
                text: "Clear goal",
                style: "destructive" as const,
                onPress: () => setGoal.mutate({ nodeId: node.id, target: null }),
              },
            ]
          : []),
        {
          text: "Save",
          onPress: (value?: string) => {
            const target = Number(value);
            if (value && Number.isFinite(target) && target >= 0 && target <= 100) {
              setGoal.mutate({ nodeId: node.id, target });
            }
          },
        },
      ],
      "plain-text",
      node.goal?.toString() ?? "",
      "decimal-pad",
    );

  return (
    <View style={styles.row}>
      {node.projection != null && (
        <Text style={styles.text}>Projected {node.projection.toFixed(1)} by season end</Text>
      )}
      <Pressable accessibilityRole="button" hitSlop={8} onPress={edit} disabled={setGoal.isPending}>
        <Text style={[styles.text, { color: colors.neon }]}>
          {node.goal != null ? `Goal ${node.goal.toFixed(1)} · edit` : "+ Set goal"}
        </Text>
      </Pressable>
      <ErrorNote error={setGoal.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  text: { color: colors.court500, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
});
