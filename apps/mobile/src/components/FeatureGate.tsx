import type { Feature } from "@rlo/shared";
import type { ReactNode } from "react";
import { useAccount } from "@/api/account";
import { usePreferences, useSetPreferences } from "@/api/preferences";
import { FEATURE_INFO } from "@/lib/featureInfo";
import { PremiumLocked } from "./Premium";
import { Body, Button, Card, Muted, Screen } from "./ui";

/**
 * Renders its screen only while the feature is switched on in Personalize and the account has
 * it (as on the web): premium features show a lock to free accounts.
 */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const prefs = usePreferences();
  const set = useSetPreferences();
  const { locked } = useAccount();
  const info = FEATURE_INFO[feature];
  if (locked[feature] === "beta") {
    return (
      <Screen title="Not found">
        <Muted>This screen isn&apos;t available.</Muted>
      </Screen>
    );
  }
  if (locked[feature] === "premium")
    return <PremiumLocked title={info.label} detail={info.detail} />;
  if (prefs.features[feature]) return children;
  return (
    <Screen title={info.label}>
      <Card style={{ gap: 12 }}>
        <Body style={{ fontWeight: "600" }}>{info.label} is switched off</Body>
        <Muted>{info.detail} Your data is kept while it&apos;s off.</Muted>
        <Button title="Turn it on" onPress={() => set({ features: { [feature]: true } })} />
      </Card>
    </Screen>
  );
}
