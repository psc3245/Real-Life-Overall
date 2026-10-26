import type { ChartConfig } from "@rlo/shared";
import { Link } from "react-router";
import { useFeature } from "../../api/preferences";
import { chartHref } from "./model";

/** Opens the chart explorer with these metrics. */
export function ChartLink({
  ids,
  config,
  label = "Chart →",
  className = "text-sm text-court-300 hover:text-neon",
}: {
  ids: string[];
  config?: Partial<ChartConfig>;
  label?: string;
  className?: string;
}) {
  if (!useFeature("charts")) return null;
  return (
    <Link to={chartHref(ids, config)} className={className}>
      {label}
    </Link>
  );
}
