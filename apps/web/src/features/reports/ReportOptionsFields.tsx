import type { ReportOptions } from "@rlo/shared";
import { useAccount } from "../../api/account";
import { PremiumBadge } from "../../components/Premium";

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
  // The AI parts are premium (DESIGN.md §8.9); free runs get summaries only.
  const { premium } = useAccount();
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
            disabled={f.ai && !premium}
            checked={value[f.key] && (premium || !f.ai)}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
            className={`${compact ? "" : "mt-1 "}accent-[var(--color-neon)]`}
          />
          <span>
            <span className="font-medium">{f.label}</span>
            {f.ai && premium && (
              <span className="ml-2 rounded bg-court-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-court-300">
                AI
              </span>
            )}
            {f.ai && !premium && <PremiumBadge className="ml-2" />}
            {!compact && <span className="block text-sm text-court-500">{f.detail}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
