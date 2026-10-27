import type { Feature } from "@rlo/shared";
import type { ReactNode } from "react";
import { usePreferences, useSetPreferences } from "@/api/preferences";
import { FEATURE_INFO } from "@/lib/featureInfo";
import { Body, Button, Card, Muted, Screen } from "./ui";

/** Renders its screen only while the feature is switched on in Personalize (as on the web). */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const prefs = usePreferences();
  const set = useSetPreferences();
  if (prefs.features[feature]) return children;
  const info = FEATURE_INFO[feature];
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
