import { Text } from "react-native";
import { colors } from "@/lib/theme";
import { Body, Card, Muted, Screen } from "./ui";

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
        <Muted style={{ fontSize: 13 }}>
          Premium is invite-only while the app is in testing. Ask the team to upgrade your account.
        </Muted>
      </Card>
    </Screen>
  );
}
