import type { BadgeTier, EarnedBadgeDto } from "@rlo/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";
import { Body, Muted } from "./ui";

export const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: "#cd8a4b",
  silver: "#c9d1d9",
  gold: "#f2c14e",
  hof: "#b56cff",
};

/** A medallion for a tier; personal badges get the neon star; locked ones are empty and muted. */
export function Medallion({
  tier,
  size = 36,
  locked = false,
}: {
  tier: BadgeTier | null;
  size?: number;
  locked?: boolean;
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (locked) return <View style={[styles.medal, box, styles.locked]} />;
  const color = tier ? TIER_COLORS[tier] : colors.neon;
  return (
    <View style={[styles.medal, box, { borderColor: color, shadowColor: color }]}>
      <Text style={{ color, fontFamily: fonts.heavy, fontSize: size * 0.42 }}>
        {tier === "hof" ? "★" : tier ? tier[0]!.toUpperCase() : "✦"}
      </Text>
    </View>
  );
}

/** "New badge" block used on recaps and weekly reviews. */
export function EarnedBadges({ badges }: { badges: EarnedBadgeDto[] }) {
  if (!badges.length) return null;
  return (
    <View style={styles.earned}>
      <Text style={styles.earnedTitle}>New badge{badges.length > 1 ? "s" : ""}</Text>
      {badges.map((b) => (
        <View key={`${b.key}-${b.tier}`} style={styles.earnedRow}>
          <Medallion tier={b.tier} size={30} />
          <View style={{ flex: 1 }}>
            <Body>{b.name}</Body>
            <Muted>{b.description}</Muted>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  locked: { borderStyle: "dashed", borderColor: colors.court700 },
  earned: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: "rgba(60,242,200,0.3)",
    backgroundColor: "rgba(60,242,200,0.05)",
    borderRadius: 10,
    padding: space.md,
  },
  earnedTitle: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  earnedRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});
