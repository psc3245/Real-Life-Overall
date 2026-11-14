import {
  BOX_SCORE_FIELDS,
  BOX_SCORE_LABELS,
  hasBoxScore,
  trainingLoad,
  type BoxScoreDto,
  type BoxScoreField,
} from "@rlo/shared";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import { StatTile } from "../../components/StatTile";
import { SettingsCard, Toggle } from "../settings/controls";
import { compactFieldClass } from "../../components/form";

const label = "block text-xs uppercase tracking-wider text-court-300";

/** 1–3 easy, 4–6 steady, 7–8 hard, 9–10 all out. */
export function effortLabel(effort: number) {
  if (effort <= 3) return "Easy";
  if (effort <= 6) return "Steady";
  if (effort <= 8) return "Hard";
  return "All out";
}

/** Effort 1-10 as a row of buttons; tapping the picked one clears it. */
export function EffortPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (effort: number | null) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={label}>
        Effort{value !== null && `: ${value}/10 · ${effortLabel(value)}`}
      </legend>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Effort ${n}`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`rounded-md py-1.5 text-sm tabular-nums ${value !== null && n <= value ? "bg-neon text-court-950" : "bg-court-800 text-court-300 hover:bg-court-700"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const PLACEHOLDERS: Record<Exclude<BoxScoreField, "effort">, string> = {
  avgHeartRate: "bpm",
  maxHeartRate: "bpm",
  calories: "kcal",
};

/** Whole numbers only; empty is null. */
const whole = (text: string) => {
  const n = Number(text.trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** The box score's inputs, limited to the fields the player asks for (settings). */
export function BoxScoreFields({
  value,
  fields,
  onChange,
}: {
  value: BoxScoreDto;
  fields: readonly BoxScoreField[];
  onChange: (next: BoxScoreDto) => void;
}) {
  const numbers = fields.filter((f): f is Exclude<BoxScoreField, "effort"> => f !== "effort");
  return (
    <div className="space-y-4">
      {numbers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {numbers.map((f) => (
            <label key={f} className="space-y-1">
              <span className={label}>{BOX_SCORE_LABELS[f]}</span>
              <input
                value={value[f]?.toString() ?? ""}
                inputMode="numeric"
                placeholder={PLACEHOLDERS[f]}
                onChange={(e) => onChange({ ...value, [f]: whole(e.target.value) })}
                className={`${compactFieldClass} w-full tabular-nums`}
              />
            </label>
          ))}
        </div>
      )}
      {fields.includes("effort") && (
        <EffortPicker value={value.effort} onChange={(effort) => onChange({ ...value, effort })} />
      )}
    </div>
  );
}

/** A finished workout's box score as stat tiles, with its training load; nothing when empty. */
export function BoxScoreTiles({ box, durationS }: { box: BoxScoreDto | null; durationS: number }) {
  if (!hasBoxScore(box)) return null;
  const load = trainingLoad(box.effort, durationS);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {box.avgHeartRate ? <StatTile label="Avg HR" value={box.avgHeartRate} /> : null}
      {box.maxHeartRate ? <StatTile label="Max HR" value={box.maxHeartRate} /> : null}
      {box.calories ? <StatTile label="Calories" value={box.calories} /> : null}
      {box.effort ? (
        <StatTile label="Effort" value={`${box.effort}/10`} detail={effortLabel(box.effort)} />
      ) : null}
      {load !== null ? (
        <StatTile label="Training load" value={load} detail="Effort × minutes" />
      ) : null}
    </dl>
  );
}

/** Settings: what the box score asks for after a workout; nothing switched on skips it. */
export function BoxScoreSettings({ id }: { id?: string }) {
  const asked = usePreferences().boxScore;
  const set = useSetPreferences();
  const toggle = (field: BoxScoreField, on: boolean) =>
    set({
      // Keep the usual order whatever order they were switched on in.
      boxScore: BOX_SCORE_FIELDS.filter((f) => (f === field ? on : asked.includes(f))),
    });
  return (
    <SettingsCard
      id={id}
      title="Box score"
      description="Asked when you finish a workout, all optional. Cardio sessions always have these fields."
    >
      {BOX_SCORE_FIELDS.map((f) => (
        <Toggle
          key={f}
          checked={asked.includes(f)}
          onChange={(on) => toggle(f, on)}
          label={BOX_SCORE_LABELS[f]}
          detail={BOX_SCORE_DETAILS[f]}
        />
      ))}
    </SettingsCard>
  );
}

const BOX_SCORE_DETAILS: Record<BoxScoreField, string> = {
  avgHeartRate: "From a watch or chest strap.",
  maxHeartRate: "Your peak for the session.",
  calories: "Active calories, from a watch or machine.",
  effort: "1-10, how hard it felt. Effort × minutes is your training load, which you can chart.",
};
