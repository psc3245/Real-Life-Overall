import { DEFAULT_PREFERENCES, FEATURES } from "@rlo/shared";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import { PrefsHeading, Toggle } from "./controls";
import { FEATURE_GROUPS, FEATURE_INFO } from "./featureInfo";

/** Switch whole parts of the app on and off. Data is kept while a part is off. */
export function ConfigurationSection() {
  const prefs = usePreferences();
  const setPreferences = useSetPreferences();
  const allOn = FEATURES.every((f) => prefs.features[f]);

  return (
    <section className="space-y-5" aria-label="Configuration">
      <PrefsHeading
        title="Configuration"
        action={
          !allOn && (
            <button
              type="button"
              className="text-court-300 hover:text-neon"
              onClick={() => setPreferences({ features: DEFAULT_PREFERENCES.features })}
            >
              Turn everything on
            </button>
          )
        }
      />
      <p className="text-sm text-court-300">
        Only use part of the app? Switch the rest off to hide its pages, menu links, Today widgets
        and day-log sections. Nothing is deleted, and recaps still see everything you've logged.
        Ratings, Today and the day log are always on.
      </p>
      {FEATURE_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-court-300">{group.label}</p>
          {group.features.map((f) => (
            <Toggle
              key={f}
              checked={prefs.features[f]}
              onChange={(on) => setPreferences({ features: { ...prefs.features, [f]: on } })}
              label={FEATURE_INFO[f].label}
              detail={FEATURE_INFO[f].detail}
            />
          ))}
        </div>
      ))}
      <p className="text-xs text-court-500">
        Weight and height tracking are switched on under Units & body tracking below.
      </p>
    </section>
  );
}
