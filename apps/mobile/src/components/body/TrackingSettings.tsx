import { UNIT_SYSTEMS, type UnitSystem } from "@rlo/shared";
import type { Me } from "@/api/hooks";
import { useUpdateProfile } from "@/api/social";
import { Segmented } from "@/components/controls";
import { SettingRow, SettingsGroup, ToggleRow } from "@/components/settings";
import { ErrorNote } from "@/components/ui";

const UNIT_LABELS: Record<UnitSystem, string> = {
  imperial: "lb · mi · ft/in",
  metric: "kg · km · cm",
};

/** Units plus the opt-in height and weight tracking (Settings and the Body screen). */
export function TrackingSettings({ me }: { me: Me }) {
  const update = useUpdateProfile();
  return (
    <SettingsGroup
      title="Units & body"
      footer="Body numbers are private: never shared on your card, and recaps treat them as context, not achievements."
    >
      <SettingRow label="Units" detail={UNIT_LABELS[me.unitSystem]}>
        <Segmented
          label="Units"
          value={me.unitSystem}
          onChange={(unitSystem) => update.mutate({ unitSystem })}
          options={UNIT_SYSTEMS.map((u) => ({
            value: u,
            label: u === "imperial" ? "Imperial" : "Metric",
          }))}
        />
      </SettingRow>
      <ToggleRow
        value={me.trackWeight}
        disabled={update.isPending}
        onChange={(trackWeight) => update.mutate({ trackWeight })}
        label="Track weight"
        detail="Adds a weight field to each day's log and a chart on the Body screen."
      />
      <ToggleRow
        value={me.trackHeight}
        disabled={update.isPending}
        onChange={(trackHeight) => update.mutate({ trackHeight })}
        label="Track height"
        detail="Log height now and then; with weight it shows BMI."
        last
      />
      <ErrorNote error={update.error} />
    </SettingsGroup>
  );
}
