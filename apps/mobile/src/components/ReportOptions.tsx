import type { ReportOptions } from "@rlo/shared";
import { ToggleRow } from "./settings";

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

/** The report's switches: summaries (free) and the AI write-up and suggestions. */
export function ReportOptionsRows({
  value,
  onChange,
}: {
  value: ReportOptions;
  onChange: (next: ReportOptions) => void;
}) {
  return (
    <>
      {FIELDS.map((f, i) => (
        <ToggleRow
          key={f.key}
          label={f.ai ? `${f.label} · AI` : f.label}
          detail={f.detail}
          value={value[f.key]}
          onChange={(on) => onChange({ ...value, [f.key]: on })}
          last={i === FIELDS.length - 1}
        />
      ))}
    </>
  );
}
