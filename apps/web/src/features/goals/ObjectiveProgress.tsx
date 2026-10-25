import type { ObjectiveDto } from "@rlo/shared";
import { formatNumber, shortDate } from "../../lib/format";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "12 days left · On pace", "Reached Oct 23", "Missed · ended Oct 25"… */
export function objectiveStatusText(o: ObjectiveDto): string {
  const p = o.progress;
  switch (p.status) {
    case "completed":
      return `Reached ${shortDate(p.completedOn!)}`;
    case "missed":
      return `Missed · ended ${shortDate(o.endsOn)}`;
    case "upcoming":
      return `Starts ${shortDate(o.startsOn)}`;
    default: {
      const left = p.daysLeft === 0 ? "Due today" : `${plural(p.daysLeft, "day")} left`;
      if (p.onPace) return `${left} · On pace`;
      const remaining = formatNumber(Math.ceil((o.target - p.current) * 10) / 10);
      if (p.daysLeft === 0) return `${left} · ${remaining} ${o.unit} to go`;
      // Today counts, so the remainder spreads over daysLeft + 1 days.
      const perDay = Math.ceil(((o.target - p.current) / (p.daysLeft + 1)) * 10) / 10;
      return `${left} · ${remaining} ${o.unit} to go (${formatNumber(perDay)}/day)`;
    }
  }
}

export function statusTone(o: ObjectiveDto): string {
  const { status, onPace } = o.progress;
  if (status === "completed") return "text-neon";
  if (status === "missed") return "text-flare";
  if (status === "active" && !onPace) return "text-tier-orange";
  return "text-court-300";
}

/** The progress bar, with a tick where an even pace would be by today. */
export function ObjectiveBar({
  objective: o,
  thin = false,
}: {
  objective: ObjectiveDto;
  thin?: boolean;
}) {
  const p = o.progress;
  const pacePct = Math.min(100, (100 * p.expected) / o.target);
  const fill =
    p.status === "completed"
      ? "bg-neon"
      : p.status === "missed"
        ? "bg-flare/70"
        : p.onPace
          ? "bg-neon/80"
          : "bg-tier-orange";
  return (
    <div
      className={`relative rounded-full bg-court-700 ${thin ? "h-1.5" : "h-2.5"}`}
      role="meter"
      aria-label={`${o.name} progress`}
      aria-valuemin={0}
      aria-valuemax={o.target}
      aria-valuenow={p.current}
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${p.pct}%` }} />
      {p.status === "active" && pacePct > 0 && pacePct < 100 && (
        <span
          aria-hidden
          title="Even pace"
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-court-100/70"
          style={{ left: `${pacePct}%` }}
        />
      )}
    </div>
  );
}

/** "37.5 / 100 miles" */
export function ObjectiveAmount({ objective: o }: { objective: ObjectiveDto }) {
  return (
    <span className="tabular-nums">
      {formatNumber(o.progress.current)}
      <span className="text-court-500">
        {" "}
        / {formatNumber(o.target)} {o.unit}
      </span>
    </span>
  );
}
