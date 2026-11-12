import {
  isPremiumRole,
  premiumTenure,
  PREMIUM_PERKS,
  ROLE_DETAILS,
  ROLE_LABELS,
  type UserRole,
} from "@rlo/shared";
import { router } from "expo-router";
import { useAiUsage } from "@/api/account";
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

/** What a free account sees in place of a premium screen, with the way to the upgrade screen. */
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
  /** Settings: also what Premium includes and today's AI use. */
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
      {perks && <AiUsageMeter premium={premium} />}
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

/** How much of today's AI budget is used, as a share only. */
function AiUsageMeter({ premium }: { premium: boolean }) {
  const usage = useAiUsage();
  if (!usage.data) return null;
  const used = usage.data.usedPercent;
  const color = used >= 100 ? colors.flare : used >= 75 ? tierColor(65) : colors.neon;
  return (
    <View
      style={{ gap: 6, paddingVertical: space.xs }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="AI budget used today"
      accessibilityValue={{ min: 0, max: 100, now: used }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Body style={{ fontWeight: "600" }}>AI used today</Body>
        <Text style={{ color: colors.court100, fontFamily: fonts.display, fontSize: 18 }}>
          {used}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${used}%`, backgroundColor: color }]} />
      </View>
      <Muted style={{ fontSize: 12 }}>
        {used >= 100
          ? "Limit reached. AI features free up as the last 24 hours roll over; recaps still run."
          : "Over the last 24 hours. Recaps and weekly reviews always run, even at the limit."}
        {premium ? "" : " Premium has a bigger budget."}
      </Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.court700, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
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
