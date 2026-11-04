import {
  isPremiumRole,
  premiumTenure,
  PREMIUM_PERKS,
  ROLE_DETAILS,
  ROLE_LABELS,
  type UserRole,
} from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { Body, Button, Card, Muted, Screen } from "./ui";

/** Every premium type wears the 90+ "elite" tier color. */
export const premiumColor = () => tierColor(95);

/** Marks a premium-only option for free accounts (DESIGN.md §8.9). */
export function PremiumBadge() {
  return (
    <Text
      style={{
        color: colors.neon,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      Premium
    </Text>
  );
}

/** What a free account sees in place of a premium screen; upgrades are by an admin for now. */
export function PremiumLocked({ title, detail }: { title: string; detail?: string }) {
  return (
    <Screen title={title}>
      <Card style={{ gap: 12 }}>
        <PremiumBadge />
        <Body style={{ fontWeight: "600" }}>{title} is Premium</Body>
        {detail ? <Muted>{detail}</Muted> : null}
        <Button title="See Premium" onPress={() => router.push("/upgrade")} />
      </Card>
    </Screen>
  );
}

/** The account type as a chip: ★ and the premium color for paid types, plain for Free. */
export function AccountBadge({ role, large = false }: { role: UserRole; large?: boolean }) {
  const premium = isPremiumRole(role);
  const color = premium ? premiumColor() : colors.court300;
  return (
    <View style={[styles.badge, { borderColor: premium ? color : colors.court700 }]}>
      <Text
        style={{
          color,
          fontFamily: fonts.display,
          fontSize: large ? 16 : 11,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {premium ? "★ " : ""}
        {ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

/**
 * The account card (You tab and Settings): type, how long it's been Premium, and the way up for
 * Free. `perks` lists what Premium includes.
 */
export function AccountCard({
  role,
  premiumSince,
  perks = false,
}: {
  role: UserRole;
  premiumSince: string | null;
  perks?: boolean;
}) {
  const premium = isPremiumRole(role);
  const tenure = premiumTenure(premiumSince);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ROLE_LABELS[role]} account${tenure ? `, ${tenure}` : ""}`}
      onPress={() => router.push("/upgrade")}
      style={[styles.card, premium && { borderColor: premiumColor() }]}
    >
      <View style={styles.head}>
        <AccountBadge role={role} large />
        {tenure ? <Muted style={{ fontSize: 13 }}>{tenure}</Muted> : null}
      </View>
      <Muted style={{ fontSize: 14 }}>{ROLE_DETAILS[role]}</Muted>
      {perks &&
        PREMIUM_PERKS.map((perk) => (
          <Text
            key={perk}
            style={{ color: premium ? colors.court100 : colors.court500, fontSize: 14 }}
          >
            {premium ? "✓ " : "🔒 "}
            {perk}
          </Text>
        ))}
      {!premium && (
        <Text style={{ color: colors.neon, fontSize: 15, fontWeight: "600" }}>
          Upgrade to Premium →
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  card: {
    gap: space.sm,
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: 1,
    borderRadius: 14,
    padding: space.lg,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
});
