import { displaySetValue, parseSetValue, type SetField, type UnitSystem } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";

const cell =
  "w-full min-w-0 rounded-md border border-transparent bg-court-800 px-2 py-1.5 text-center tabular-nums outline-none placeholder:text-court-500 focus:border-neon disabled:opacity-60";

export const displayValue = displaySetValue;
const parseValue = parseSetValue;

/**
 * One editable number in the set table. It keeps its own text while typing (so "13" on the way
 * to "135" isn't converted and rounded back) and resyncs when the stored value changes elsewhere.
 */
export function SetCell({
  field,
  value,
  units,
  placeholder,
  label,
  disabled,
  onChange,
}: {
  field: SetField;
  value: number | null;
  units: UnitSystem;
  placeholder?: string;
  label: string;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const shown = displayValue(field, value, units);
  const [text, setText] = useState(shown);
  const emitted = useRef(value);
  useEffect(() => {
    // A value that didn't come from typing here (e.g. copied from "Previous") replaces the text.
    if (value !== emitted.current) {
      emitted.current = value;
      setText(shown);
    }
  }, [value, shown]);

  return (
    <input
      aria-label={label}
      inputMode={
        field === "duration"
          ? "text"
          : field === "reps" || field === "attempts"
            ? "numeric"
            : "decimal"
      }
      value={text}
      disabled={disabled}
      placeholder={placeholder ?? (field === "duration" ? "m:ss" : "")}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseValue(field, e.target.value, units);
        if (parsed !== undefined) {
          emitted.current = parsed;
          onChange(parsed);
        }
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        // Enter confirms the cell instead of submitting a surrounding form.
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cell}
    />
  );
}
