import type { Feature } from "@rlo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { usePreferences, useSetPreferences } from "../api/preferences";
import { FEATURE_INFO } from "../features/settings/featureInfo";
import { preferencesLink } from "../features/settings/PreferencesModal";
import { Button } from "./Button";

/** Renders its page only while the feature is switched on in settings. */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const prefs = usePreferences();
  const setPreferences = useSetPreferences();
  if (prefs.features[feature]) return children;
  const info = FEATURE_INFO[feature];
  return (
    <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
      <p className="font-display text-3xl uppercase">{info.label} is switched off</p>
      <p className="text-court-300">{info.detail} Your data is kept while it's off.</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          variant="primary"
          onClick={() => setPreferences({ features: { ...prefs.features, [feature]: true } })}
        >
          Turn it on
        </Button>
        <Link to={preferencesLink("configuration")} className="text-sm text-neon hover:underline">
          Configuration →
        </Link>
      </div>
    </div>
  );
}
