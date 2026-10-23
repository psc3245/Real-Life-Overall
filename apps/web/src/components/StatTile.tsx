import type { ReactNode } from "react";

/** A labeled big number for stat rows; use inside a <dl>. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-3">
      <dt className="text-xs uppercase tracking-wider text-court-500">{label}</dt>
      <dd className="font-display text-3xl tabular-nums">{value}</dd>
      {detail && <dd className="truncate text-sm text-court-300">{detail}</dd>}
    </div>
  );
}
