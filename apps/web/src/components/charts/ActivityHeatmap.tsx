import { dayOfWeek, type ActivityDayDto } from "@rlo/shared";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Delta } from "../Delta";
import { dayLabel } from "../../lib/format";

const CELL = 13;
const GAP = 3;
/** One-hue sequential ramp in the accent color: more rating gained, stronger. */
const LEVELS = [
  "var(--color-court-800)", // nothing logged
  "color-mix(in srgb, var(--color-neon) 25%, transparent)", // logged
  "color-mix(in srgb, var(--color-neon) 50%, transparent)",
  "color-mix(in srgb, var(--color-neon) 75%, transparent)",
  "var(--color-neon)",
];

function level(day: ActivityDayDto): number {
  if (!day.logged) return 0;
  if (day.gain >= 2) return 4;
  if (day.gain >= 1) return 3;
  if (day.gain > 0) return 2;
  return 1;
}

export function describe(day: ActivityDayDto) {
  const parts = [day.date, day.logged ? "logged" : "nothing logged"];
  if (day.recapped) parts.push("recapped");
  if (day.gain) parts.push(`+${day.gain.toFixed(1)} gained`);
  if (day.loss) parts.push(`${day.loss.toFixed(1)} lost`);
  return parts.join(" · ");
}

interface Hover {
  day: ActivityDayDto;
  left: number;
  top: number;
}

/**
 * GitHub-style calendar: one column per week, Sunday at the top. Hovering (or focusing, or
 * tapping) a day shows its rating change and recap summary; clicking opens that day's log.
 */
export function ActivityHeatmap({ days }: { days: ActivityDayDto[] }) {
  const navigate = useNavigate();
  const figure = useRef<HTMLElement>(null);
  const pointer = useRef<string>("mouse");
  const [hover, setHover] = useState<Hover | null>(null);
  if (!days.length) return null;
  const offset = dayOfWeek(days[0]!.date);
  const weeks = Math.ceil((days.length + offset) / 7);
  const logged = days.filter((d) => d.logged).length;

  const show = (day: ActivityDayDto, target: Element) => {
    const box = figure.current?.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    if (!box) return;
    setHover({ day, left: cell.left - box.left + cell.width / 2, top: cell.top - box.top });
  };

  return (
    <figure ref={figure} className="relative space-y-2" onMouseLeave={() => setHover(null)}>
      <div className="overflow-x-auto">
        <svg
          width={weeks * (CELL + GAP)}
          height={7 * (CELL + GAP)}
          role="group"
          aria-label={`Logged ${logged} of the last ${days.length} days`}
        >
          {days.map((day, i) => {
            const slot = i + offset;
            const active = hover?.day.date === day.date;
            return (
              <rect
                key={day.date}
                x={Math.floor(slot / 7) * (CELL + GAP)}
                y={(slot % 7) * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={3}
                fill={LEVELS[level(day)]}
                stroke={active ? "var(--color-court-100)" : "none"}
                strokeWidth={1.5}
                role="button"
                tabIndex={0}
                aria-label={describe(day)}
                className="cursor-pointer outline-none"
                onPointerDown={(e) => (pointer.current = e.pointerType)}
                onMouseEnter={(e) => show(day, e.currentTarget)}
                onFocus={(e) => show(day, e.currentTarget)}
                onBlur={() => setHover(null)}
                onClick={(e) => {
                  // A tap shows the card first; the card's link opens the day.
                  if (pointer.current === "touch" && !active) show(day, e.currentTarget);
                  else navigate(`/log?date=${day.date}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/log?date=${day.date}`);
                  }
                }}
              />
            );
          })}
        </svg>
      </div>
      {hover && <DayCard hover={hover} />}
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

function DayCard({ hover: { day, left, top } }: { hover: Hover }) {
  const net = Math.round((day.gain + day.loss) * 100) / 100;
  return (
    <div
      role="tooltip"
      className="pointer-events-auto absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-court-700 bg-court-950 p-3 text-sm shadow-xl"
      // Clamp so the card stays inside the figure near its edges.
      style={{ left: `clamp(7rem, ${left}px, calc(100% - 7rem))`, top: top - 6 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display uppercase tracking-wider">{dayLabel(day.date)}</span>
        {day.gain || day.loss ? <Delta value={net} /> : <span className="text-court-500">±0</span>}
      </div>
      <p className="text-xs text-court-500">
        {day.logged ? "Logged" : "Nothing logged"}
        {day.recapped && " · recapped"}
        {(day.gain > 0 || day.loss < 0) && (
          <>
            {" · "}
            <span className="text-tier-green">+{day.gain.toFixed(1)}</span>
            {" / "}
            <span className="text-tier-red">{day.loss.toFixed(1)}</span>
          </>
        )}
      </p>
      {day.summary && <p className="mt-1.5 text-court-300">{day.summary}</p>}
      <Link to={`/log?date=${day.date}`} className="mt-1.5 inline-block text-xs text-neon">
        Open day →
      </Link>
    </div>
  );
}
