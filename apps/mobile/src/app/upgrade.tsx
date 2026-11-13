import { premiumTenure, PREMIUM_PERKS, ROLE_LABELS, type SelfServeRole } from "@rlo/shared";
import { Stack } from "expo-router";
import { Alert, Text, View } from "react-native";
import { useAccount, useSetOwnRole } from "@/api/account";
import { useMe } from "@/api/hooks";
import { AccountBadge, premiumColor } from "@/components/Premium";
import { Button, Card, ErrorNote, Muted, Screen } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";

const PLANS: { role: SelfServeRole; tagline: string; includes: readonly string[] }[] = [
  { role: "premium", tagline: "Everything in Free, plus", includes: PREMIUM_PERKS },
  {
    role: "dev",
    tagline: "Play tester: everything in Premium, plus",
    includes: [
      "Features still in testing, like Souls seasons",
      "Report a bug from the You tab",
      "Your feedback shapes what ships next",
    ],
  },
  {
    role: "user",
    tagline: "The core game",
    includes: [
      "Growth seasons: every point you gain counts",
      "Daily recaps and weekly reviews",
      "The Combine for your starting ratings",
      "Habits, goals, workouts, charts and reports",
    ],
  },
];

/**
 * Free, Premium and Dev (web /upgrade). No checkout yet: while `SELF_UPGRADES` is on players
 * switch plans themselves at no charge; off, upgrades go through an admin.
 */
export default function UpgradeScreen() {
  const { role, premium } = useAccount();
  const me = useMe();
  const setRole = useSetOwnRole();
  const tenure = premiumTenure(me.data?.premiumSince ?? null);
  // Admins keep their type; the front office changes it.
  const canSwitch = Boolean(me.data?.selfUpgrade) && role !== "admin";

  const choose = (next: SelfServeRole) => {
    if (next !== "user") return setRole.mutate(next);
    Alert.alert(
      "Switch to Free?",
      "The coach and AI assists lock right away, and a Rating season turns into Growth when the next season starts. You can switch back any time.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch to Free", style: "destructive", onPress: () => setRole.mutate("user") },
      ],
    );
  };

  return (
    <Screen
      eyebrow="★ Premium"
      title={premium ? `You're on ${ROLE_LABELS[role]}` : "Go Premium"}
      subtitle={`${premium && tenure ? `${tenure}. ` : ""}${
        canSwitch
          ? "Every plan is free while the app is in testing. Switch whenever you like."
          : "Rating seasons, the coach and every AI assist."
      }`}
    >
      <Stack.Screen options={{ title: "Premium" }} />
      {PLANS.map((plan) => {
        const current = plan.role === role;
        const paid = plan.role !== "user";
        const accent = paid ? premiumColor() : colors.court100;
        return (
          <Card
            key={plan.role}
            style={{ gap: space.sm, borderColor: current ? premiumColor() : undefined }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[title, { color: accent }]}>{ROLE_LABELS[plan.role]}</Text>
              {current && <AccountBadge role={role} />}
            </View>
            <Muted>{plan.tagline}</Muted>
            {plan.includes.map((line) => (
              <Text key={line} style={{ color: colors.court100, fontSize: 15, lineHeight: 21 }}>
                <Text style={{ color: accent }}>{paid ? "★ " : "✓ "}</Text>
                {line}
              </Text>
            ))}
            {current ? (
              <Muted style={{ textAlign: "center", fontSize: 13 }}>Your plan</Muted>
            ) : (
              canSwitch && (
                <Button
                  title={paid ? `Get ${ROLE_LABELS[plan.role]} · Free` : "Switch to Free"}
                  variant={paid ? "primary" : "ghost"}
                  busy={setRole.isPending && setRole.variables === plan.role}
                  disabled={setRole.isPending}
                  onPress={() => choose(plan.role)}
                />
              )
            )}
          </Card>
        );
      })}
      {setRole.error && <ErrorNote error={setRole.error} />}
      {role === "admin" && (
        <Muted style={{ textAlign: "center", fontSize: 13 }}>
          Admin accounts include everything. Change account types from the front office.
        </Muted>
      )}
      {!me.data?.selfUpgrade && !premium && (
        <Muted style={{ textAlign: "center", fontSize: 13 }}>
          Premium is invite-only while the app is in testing. Ask the team to upgrade your account.
        </Muted>
      )}
    </Screen>
  );
}

const title = {
  fontFamily: fonts.display,
  fontSize: 24,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
};
