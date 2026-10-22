import { dayOfWeek, type ActivityDayDto } from "@rlo/shared";

const CELL = 13;
const GAP = 3;
/** One-hue sequential ramp on the dark surface: more rating gained, brighter. */
const LEVELS = [
  "var(--color-court-800)", // nothing logged
  "rgb(60 242 200 / 0.25)", // logged
  "rgb(60 242 200 / 0.5)",
  "rgb(60 242 200 / 0.75)",
  "rgb(60 242 200 / 1)",
];

function level(day: ActivityDayDto): number {
  if (!day.logged) return 0;
  if (day.gain >= 2) return 4;
  if (day.gain >= 1) return 3;
  if (day.gain > 0) return 2;
  return 1;
}

function describe(day: ActivityDayDto) {
  const parts = [day.date, day.logged ? "logged" : "nothing logged"];
  if (day.recapped) parts.push("recapped");
  if (day.gain) parts.push(`+${day.gain.toFixed(1)} gained`);
  if (day.loss) parts.push(`${day.loss.toFixed(1)} lost`);
  return parts.join(" · ");
}

/** GitHub-style calendar: one column per week, Sunday at the top. */
export function ActivityHeatmap({ days }: { days: ActivityDayDto[] }) {
  if (!days.length) return null;
  const offset = dayOfWeek(days[0]!.date);
  const weeks = Math.ceil((days.length + offset) / 7);
  const logged = days.filter((d) => d.logged).length;
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          width={weeks * (CELL + GAP)}
          height={7 * (CELL + GAP)}
          role="img"
          aria-label={`Logged ${logged} of the last ${days.length} days`}
        >
          {days.map((day, i) => {
            const slot = i + offset;
            return (
              <rect
                key={day.date}
                x={Math.floor(slot / 7) * (CELL + GAP)}
                y={(slot % 7) * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={3}
                fill={LEVELS[level(day)]}
              >
                <title>{describe(day)}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center gap-2 text-xs text-court-500">
        <span>
          Logged {logged} of {days.length} days.
        </span>
        <span className="ml-auto flex items-center gap-1">
          Less
          {LEVELS.map((c) => (
            <span key={c} className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />
          ))}
          More gained
        </span>
      </figcaption>
    </figure>
  );
}
