import {
  CM_PER_INCH,
  fromDisplayWeight,
  toDisplayWeight,
  weightUnit,
  type UnitSystem,
} from "@rlo/shared";
import { useState } from "react";

const field =
  "w-20 rounded-lg border border-court-700 bg-court-950 px-3 py-1.5 text-right tabular-nums outline-none focus:border-neon disabled:opacity-60";

/** A weight in the user's unit; commits kg (or null to clear) on blur or Enter. */
export function WeightInput({
  kg,
  units,
  placeholderKg,
  disabled,
  onCommit,
}: {
  kg: number | null;
  units: UnitSystem;
  placeholderKg?: number | null;
  disabled?: boolean;
  onCommit: (kg: number | null) => void;
}) {
  const [text, setText] = useState(kg === null ? "" : String(toDisplayWeight(kg, units)));
  const commit = () => {
    const t = text.trim();
    if (!t) return kg !== null && onCommit(null);
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return;
    const next = fromDisplayWeight(n, units);
    if (kg === null || Math.abs(next - kg) > 0.01) onCommit(next);
  };
  return (
    <span className="flex items-center gap-2 text-sm text-court-300">
      <input
        aria-label={`Weight in ${weightUnit(units)}`}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        placeholder={placeholderKg ? String(toDisplayWeight(placeholderKg, units)) : "0"}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={field}
      />
      {weightUnit(units)}
    </span>
  );
}

/** Height as feet + inches or cm; commits cm (or null) on blur or Enter. */
export function HeightInput({
  cm,
  units,
  placeholderCm,
  disabled,
  onCommit,
}: {
  cm: number | null;
  units: UnitSystem;
  placeholderCm?: number | null;
  disabled?: boolean;
  onCommit: (cm: number | null) => void;
}) {
  const totalIn = (v: number | null | undefined) => (v ? Math.round(v / CM_PER_INCH) : null);
  const inches = totalIn(cm);
  const [ft, setFt] = useState(inches === null ? "" : String(Math.floor(inches / 12)));
  const [inch, setInch] = useState(inches === null ? "" : String(inches % 12));
  const [metric, setMetric] = useState(cm === null ? "" : String(Math.round(cm)));
  const hint = totalIn(placeholderCm);

  const commit = () => {
    let next: number | null;
    if (units === "metric") {
      next = metric.trim() ? Number(metric) : null;
    } else {
      next =
        ft.trim() || inch.trim()
          ? ((Number(ft) || 0) * 12 + (Number(inch) || 0)) * CM_PER_INCH
          : null;
    }
    if (next !== null && (!Number.isFinite(next) || next <= 0)) return;
    if (next === null ? cm !== null : cm === null || Math.abs(next - cm) > 0.5) onCommit(next);
  };
  const keys = {
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
      e.key === "Enter" && (e.target as HTMLInputElement).blur(),
  };

  if (units === "metric") {
    return (
      <span className="flex items-center gap-2 text-sm text-court-300">
        <input
          aria-label="Height in cm"
          inputMode="numeric"
          value={metric}
          disabled={disabled}
          placeholder={placeholderCm ? String(Math.round(placeholderCm)) : "0"}
          onChange={(e) => setMetric(e.target.value)}
          className={field}
          {...keys}
        />
        cm
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-sm text-court-300">
      <input
        aria-label="Height, feet"
        inputMode="numeric"
        value={ft}
        disabled={disabled}
        placeholder={hint ? String(Math.floor(hint / 12)) : "5"}
        onChange={(e) => setFt(e.target.value)}
        className={`${field} w-14`}
        {...keys}
      />
      ft
      <input
        aria-label="Height, inches"
        inputMode="numeric"
        value={inch}
        disabled={disabled}
        placeholder={hint ? String(hint % 12) : "10"}
        onChange={(e) => setInch(e.target.value)}
        className={`${field} w-14`}
        {...keys}
      />
      in
    </span>
  );
}
