import { UNIT_SYSTEMS, type UnitSystem } from "@rlo/shared";
import type { Me } from "../../api/hooks";
import { useUpdateProfile } from "../../api/social";
import { ErrorNote } from "../onboarding/ErrorNote";

const UNIT_LABELS: Record<UnitSystem, string> = {
  imperial: "lb · mi · ft/in",
  metric: "kg · km · cm",
};

/** Units plus the opt-in height and weight tracking (settings and the Body page). */
export function TrackingSettings({ me }: { me: Me }) {
  const update = useUpdateProfile();
  const toggle = (key: "trackWeight" | "trackHeight", label: string, detail: string) => (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-court-700 px-4 py-3 hover:border-court-500">
      <input
        type="checkbox"
        checked={me[key]}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ [key]: e.target.checked })}
        className="mt-1 accent-[var(--color-neon)]"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-court-500">{detail}</span>
      </span>
    </label>
  );
  return (
    <section className="space-y-4" aria-label="Units and tracking">
      <h2 className="font-display text-xl uppercase tracking-wider">Units & body tracking</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Units">
        {UNIT_SYSTEMS.map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={me.unitSystem === u}
            disabled={update.isPending}
            onClick={() => update.mutate({ unitSystem: u })}
            className={`rounded-lg border px-4 py-2 text-sm ${me.unitSystem === u ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            <span className="block font-medium capitalize">{u}</span>
            <span className="block text-xs text-court-500">{UNIT_LABELS[u]}</span>
          </button>
        ))}
      </div>
      {toggle(
        "trackWeight",
        "Track weight",
        "Adds a weight field to each day's log and a chart on the Body page.",
      )}
      {toggle("trackHeight", "Track height", "Log height now and then; with weight it shows BMI.")}
      <p className="text-xs text-court-500">
        Body numbers are private: they're never shared on your card. Recaps treat them as context,
        not achievements.
      </p>
      <ErrorNote error={update.error} />
    </section>
  );
}
