import type { Feature } from "@rlo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAccount } from "../api/account";
import { usePreferences, useSetPreferences } from "../api/preferences";
import { NotFound } from "../routes/NotFound";
import { FEATURE_INFO } from "../features/settings/featureInfo";
import { preferencesLink } from "../features/settings/PreferencesModal";
import { Button } from "./Button";
import { PremiumLocked } from "./Premium";

/**
 * Renders its page only while the feature is switched on in settings and the account has it:
 * premium features show a lock to free accounts, features in testing don't exist for them.
 */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const prefs = usePreferences();
  const setPreferences = useSetPreferences();
  const { locked } = useAccount();
  const info = FEATURE_INFO[feature];
  if (locked[feature] === "beta") return <NotFound />;
  if (locked[feature] === "premium") {
    return <PremiumLocked title={`${info.label} is Premium`}>{info.detail}</PremiumLocked>;
  }
  if (prefs.features[feature]) return children;
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
          All features →
        </Link>
      </div>
    </div>
  );
}
