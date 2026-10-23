import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";

/** A labeled big number for stat rows. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Tiles two to a row. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: space.md,
  },
  label: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  value: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 28 },
  detail: { color: colors.court300, fontSize: 13 },
});
