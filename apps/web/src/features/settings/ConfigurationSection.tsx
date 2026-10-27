import { DEFAULT_PREFERENCES, FEATURES } from "@rlo/shared";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import { HeaderAction, SaveStatus, SettingsCard, Toggle } from "./controls";
import { FEATURE_GROUPS, FEATURE_INFO } from "./featureInfo";
import { useTalk } from "../../lib/talk";

/** Switch whole parts of the app on and off. Data is kept while a part is off. */
export function ConfigurationSection() {
  const talk = useTalk();
  const prefs = usePreferences();
  const setPreferences = useSetPreferences();
  const allOn = FEATURES.every((f) => prefs.features[f]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
        <p className="max-w-xl text-court-300">
          Only use part of the app? Switch the rest off to hide its pages, menu links, Today widgets
          and day-log sections. Nothing is deleted, and recaps still see everything you've logged.
          Ratings, Today and the day log are always on.
        </p>
        <span className="flex items-baseline gap-4">
          <SaveStatus />
          {!allOn && (
            <HeaderAction
              onClick={() => setPreferences({ features: DEFAULT_PREFERENCES.features })}
            >
              Turn everything on
            </HeaderAction>
          )}
        </span>
      </div>
      {FEATURE_GROUPS.map((group) => (
        <SettingsCard key={group.label} title={group.label}>
          {group.features.map((f) => (
            <Toggle
              key={f}
              checked={prefs.features[f]}
              onChange={(on) => setPreferences({ features: { ...prefs.features, [f]: on } })}
              label={f === "coach" ? talk.coach : FEATURE_INFO[f].label}
              detail={FEATURE_INFO[f].detail}
            />
          ))}
        </SettingsCard>
      ))}
      <p className="text-xs text-court-500">
        Weight and height tracking are switched on in Settings, under Units & body.
      </p>
    </div>
  );
}
