import { premiumTenure, PREMIUM_PERKS } from "@rlo/shared";
import { Stack } from "expo-router";
import { Text, View } from "react-native";
import { useAccount } from "@/api/account";
import { useMe } from "@/api/hooks";
import { AccountBadge, premiumColor } from "@/components/Premium";
import { Button, Card, Label, Muted, Screen } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";

const FREE_INCLUDES = [
  "Growth seasons: every point you gain counts",
  "Daily recaps and weekly reviews",
  "The Combine for your starting ratings",
  "Habits, goals, workouts, charts and reports",
];

/** Premium's pitch (web /upgrade). No checkout yet: Premium is invite-only while in testing. */
export default function UpgradeScreen() {
  const { role, premium } = useAccount();
  const me = useMe();
  const tenure = premiumTenure(me.data?.premiumSince ?? null);
  return (
    <Screen
      eyebrow="★ Premium"
      title={premium ? "You're on Premium" : "Go Premium"}
      subtitle={
        premium
          ? `${tenure ?? "Premium"}. Everything below is unlocked.`
          : "Rating seasons, the coach and every AI assist."
      }
    >
      <Stack.Screen options={{ title: "Premium" }} />
      <Card style={{ gap: space.sm, borderColor: premiumColor() }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[title, { color: premiumColor() }]}>Premium</Text>
          {premium && <AccountBadge role={role} />}
        </View>
        <Muted>Everything in Free, plus</Muted>
        {PREMIUM_PERKS.map((perk) => (
          <Text key={perk} style={{ color: colors.court100, fontSize: 15, lineHeight: 21 }}>
            <Text style={{ color: premiumColor() }}>★ </Text>
            {perk}
          </Text>
        ))}
        {!premium && <Button title="Coming soon" disabled onPress={() => {}} />}
      </Card>
      <View style={{ gap: space.sm }}>
        <Label>Free</Label>
        <Card style={{ gap: space.sm }}>
          {FREE_INCLUDES.map((line) => (
            <Muted key={line}>✓ {line}</Muted>
          ))}
        </Card>
      </View>
      {!premium && (
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
