import type { ReactNode } from "react";
import { useSaveStatus } from "../../api/preferences";

/**
 * Settings are cards of rows: a label (and optional detail) on the left, its control on the
 * right. Cards group related rows; the row dividers come from the card.
 */
export function SettingsCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="scroll-mt-20 overflow-hidden rounded-xl border border-court-700 bg-court-900/60"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-court-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold uppercase tracking-wider">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-court-500">{description}</p>}
        </div>
        {action && <div className="flex items-baseline gap-4 text-sm">{action}</div>}
      </header>
      <div className="divide-y divide-court-800">{children}</div>
    </section>
  );
}

/** One setting: label and detail on the left, the control on the right (below on phones). */
export function SettingRow({
  label,
  detail,
  htmlFor,
  children,
  disabled,
}: {
  label: ReactNode;
  detail?: ReactNode;
  /** The control's id, so clicking the label focuses it. */
  htmlFor?: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <Label htmlFor={htmlFor} className="min-w-0 flex-1 basis-56">
        <span className="block text-sm font-medium text-court-100">{label}</span>
        {detail && <span className="mt-0.5 block text-xs text-court-500">{detail}</span>}
      </Label>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** A full-width block inside a card (pickers, forms, lists). */
export function SettingBlock({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 px-4 py-3">
      {label && <p className="text-sm font-medium text-court-100">{label}</p>}
      {children}
    </div>
  );
}

/** An on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the row's visible label. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:cursor-not-allowed ${checked ? "border-neon bg-neon/80" : "border-court-500 bg-court-800"}`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full transition ${checked ? "translate-x-5 bg-court-950" : "bg-court-300"}`}
      />
    </button>
  );
}

/** A switch row: the shape most on/off settings take. */
export function Toggle({
  checked,
  onChange,
  label,
  detail,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <SettingRow label={label} detail={detail} disabled={disabled}>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </SettingRow>
  );
}

/** A dropdown for settings with several options. */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  id,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={String(value)}
      disabled={disabled}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className="min-w-36 cursor-pointer rounded-lg border border-court-700 bg-court-950 py-1.5 pr-8 pl-3 text-sm text-court-100 outline-none hover:border-court-500 focus:border-neon disabled:cursor-not-allowed"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A compact row of mutually exclusive options, for two to four short choices. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-court-700 bg-court-950 p-0.5"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition ${value === o.value ? "bg-neon/15 text-neon" : "text-court-300 hover:text-court-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The shared autosave status for preference changes. */
export function SaveStatus() {
  const status = useSaveStatus();
  return (
    <span aria-live="polite" className={status === "error" ? "text-flare" : "text-court-500"}>
      {status === "saving" ? "Saving…" : status === "error" ? "Couldn't save" : ""}
    </span>
  );
}

/** A quiet text action for card headers ("Reset", "View →"). */
export function HeaderAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-court-300 hover:text-neon">
      {children}
    </button>
  );
}
