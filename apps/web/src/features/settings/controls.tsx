import type { ReactNode } from "react";
import { useSaveStatus } from "../../api/preferences";

/** A row of mutually exclusive options (text size, density, corners…). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wider text-court-300">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${value === o.value ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-court-500">{hint}</p>}
    </div>
  );
}

/** A labelled checkbox row, the same shape as the tracking and sharing toggles. */
export function Toggle({
  checked,
  onChange,
  label,
  detail,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex gap-3 rounded-lg border border-court-700 px-4 py-3 ${disabled ? "opacity-50" : "cursor-pointer hover:border-court-500"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-[var(--color-neon)]"
      />
      <span>
        <span className="block font-medium">{label}</span>
        {detail && <span className="block text-sm text-court-500">{detail}</span>}
      </span>
    </label>
  );
}

/** Section heading with the shared autosave status for preference changes. */
export function PrefsHeading({ title, action }: { title: string; action?: ReactNode }) {
  const status = useSaveStatus();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-display text-xl uppercase tracking-wider">{title}</h2>
      <span className="flex items-baseline gap-4 text-sm">
        <span aria-live="polite" className={status === "error" ? "text-flare" : "text-court-500"}>
          {status === "saving" ? "Saving…" : status === "error" ? "Couldn't save" : ""}
        </span>
        {action}
      </span>
    </div>
  );
}
