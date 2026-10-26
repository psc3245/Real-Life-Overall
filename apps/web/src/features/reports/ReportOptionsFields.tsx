import type { ReportOptions } from "@rlo/shared";

const FIELDS: { key: keyof ReportOptions; label: string; detail: string; ai: boolean }[] = [
  {
    key: "summaries",
    label: "Summaries",
    detail: "A plain sentence per chart from its numbers.",
    ai: false,
  },
  {
    key: "writeUp",
    label: "Write-up",
    detail: "A short narrative of the period that connects the charts.",
    ai: true,
  },
  {
    key: "suggestions",
    label: "Suggestions",
    detail: "A few concrete next steps based on what the charts show.",
    ai: true,
  },
];

/** The report's checkboxes: summaries (free) and the AI write-up and suggestions. */
export function ReportOptionsFields({
  value,
  onChange,
  compact = false,
}: {
  value: ReportOptions;
  onChange: (next: ReportOptions) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className={compact ? "flex flex-wrap gap-x-5 gap-y-2" : "space-y-2"}>
      <legend className="sr-only">Include</legend>
      {FIELDS.map((f) => (
        <label
          key={f.key}
          className={
            compact
              ? "flex cursor-pointer items-center gap-2 text-sm"
              : "flex cursor-pointer gap-3 rounded-lg border border-court-700 px-4 py-3 hover:border-court-500"
          }
        >
          <input
            type="checkbox"
            checked={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
            className={`${compact ? "" : "mt-1 "}accent-[var(--color-neon)]`}
          />
          <span>
            <span className="font-medium">{f.label}</span>
            {f.ai && (
              <span className="ml-2 rounded bg-court-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-court-300">
                AI
              </span>
            )}
            {!compact && <span className="block text-sm text-court-500">{f.detail}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
