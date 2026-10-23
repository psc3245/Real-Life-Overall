import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { colors, space } from "@/lib/theme";

/** A small attribute tag that opens the attribute's page. */
export function NodeChip({ id, name }: { id: string; name: string | undefined }) {
  return (
    <Link href={{ pathname: "/node/[id]", params: { id } }} style={styles.chip}>
      <Text style={styles.text}>{name ?? "?"}</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.court800,
    borderRadius: 4,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 2,
    overflow: "hidden",
  },
  text: { color: colors.court300, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
});
