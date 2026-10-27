import { leafIds, type RatedNodeDto } from "@rlo/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/lib/theme";
import { Chip } from "./controls";

/** Rated attributes as toggle chips, grouped by category. */
export function AttributePicker({
  nodes,
  selected,
  onToggle,
}: {
  nodes: RatedNodeDto[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const leaves = new Set(leafIds(nodes));
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const leavesUnder = (id: string): RatedNodeDto[] =>
    leaves.has(id)
      ? nodes.filter((n) => n.id === id)
      : nodes.filter((n) => n.parentId === id).flatMap((c) => leavesUnder(c.id));

  return (
    <View style={{ gap: space.md }}>
      {categories.map((c) => (
        <View key={c.id} style={{ gap: space.xs }}>
          <Text style={styles.category}>{c.name}</Text>
          <View style={styles.chips}>
            {leavesUnder(c.id).map((leaf) => (
              <Chip
                key={leaf.id}
                label={leaf.name}
                selected={selected.includes(leaf.id)}
                onPress={() => onToggle(leaf.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  category: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
