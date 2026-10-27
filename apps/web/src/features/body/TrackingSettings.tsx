import { UNIT_SYSTEMS, type UnitSystem } from "@rlo/shared";
import type { Me } from "../../api/hooks";
import { useUpdateProfile } from "../../api/social";
import { ErrorNote } from "../onboarding/ErrorNote";
import { Segmented, SettingBlock, SettingRow, SettingsCard, Toggle } from "../settings/controls";

const UNIT_LABELS: Record<UnitSystem, string> = {
  imperial: "lb · mi · ft/in",
  metric: "kg · km · cm",
};

/** Units plus the opt-in height and weight tracking (settings and the Body page). */
export function TrackingSettings({ me, id }: { me: Me; id?: string }) {
  const update = useUpdateProfile();
  return (
    <SettingsCard
      id={id}
      title="Units & body"
      description="Body numbers are private: never shared on your card, and recaps treat them as context, not achievements."
    >
      <SettingRow label="Units" detail={UNIT_LABELS[me.unitSystem]}>
        <Segmented
          label="Units"
          value={me.unitSystem}
          disabled={update.isPending}
          onChange={(unitSystem) => update.mutate({ unitSystem })}
          options={UNIT_SYSTEMS.map((u) => ({
            value: u,
            label: u === "imperial" ? "Imperial" : "Metric",
          }))}
        />
      </SettingRow>
      <Toggle
        checked={me.trackWeight}
        disabled={update.isPending}
        onChange={(trackWeight) => update.mutate({ trackWeight })}
        label="Track weight"
        detail="Adds a weight field to each day's log and a chart on the Body page."
      />
      <Toggle
        checked={me.trackHeight}
        disabled={update.isPending}
        onChange={(trackHeight) => update.mutate({ trackHeight })}
        label="Track height"
        detail="Log height now and then; with weight it shows BMI."
      />
      {update.error && (
        <SettingBlock>
          <ErrorNote error={update.error} />
        </SettingBlock>
      )}
    </SettingsCard>
  );
}
