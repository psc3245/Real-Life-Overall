import { objectivePacePct, type ObjectiveDto } from "@rlo/shared";
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
      // Reach goals can be heading down; what's left is the distance either way.
      const gap = o.kind === "reach" ? Math.abs(o.target - p.current) : o.target - p.current;
      const remaining = formatNumber(Math.ceil(gap * 10) / 10);
      if (p.daysLeft === 0) return `${left} · ${remaining} ${o.unit} to go`;
      // Today counts, so the remainder spreads over daysLeft + 1 days.
      const perDay = Math.ceil((gap / (p.daysLeft + 1)) * 10) / 10;
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
  const pacePct = objectivePacePct(o);
  const reach = o.kind === "reach";
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
      // A reach goal can head down, so its meter is the share of the way there.
      aria-valuemin={0}
      aria-valuemax={reach ? 100 : o.target}
      aria-valuenow={reach ? Math.round(p.pct) : p.current}
      aria-valuetext={reach ? `${formatNumber(p.current)} ${o.unit}` : undefined}
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

/** "37.5 / 100 miles", or for reach goals "196 → 185 lb from 200" */
export function ObjectiveAmount({ objective: o }: { objective: ObjectiveDto }) {
  if (o.kind === "reach") {
    return (
      <span className="tabular-nums">
        {formatNumber(o.progress.current)}
        <span className="text-court-500">
          {" "}
          → {formatNumber(o.target)} {o.unit} · from {formatNumber(o.startValue ?? 0)}
        </span>
      </span>
    );
  }
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
