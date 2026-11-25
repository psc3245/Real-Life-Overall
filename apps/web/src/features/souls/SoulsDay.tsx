import {
  DEATH_CAUSE_LABELS,
  earningParts,
  formatSouls,
  totalEarned,
  type SoulDayDto,
} from "@rlo/shared";
import { useTalk } from "../../lib/talk";

/**
 * A Souls day on its recap (DESIGN.md §4.7): the souls it earned by source, in place of the
 * overall move (the rating, which Souls seasons don't show), and whether the day died.
 */
export function SoulsDay({ day }: { day: SoulDayDto }) {
  const talk = useTalk();
  const earned = totalEarned(day.earned);
  const parts = earningParts(day.earned, talk.souls.boss);
  return (
    <div className="space-y-0.5 text-right">
      <p className="font-display text-lg tabular-nums text-court-300">
        <span className={earned > 0 ? "text-neon" : "text-court-500"}>
          {earned > 0 ? "+" : ""}
          {formatSouls(earned)}
        </span>{" "}
        {talk.souls.souls}
      </p>
      {parts.length > 1 && (
        <p className="text-xs text-court-500">
          {parts.map(([k, n]) => `${n > 0 ? "+" : ""}${formatSouls(n)} ${k}`).join(" · ")}
        </p>
      )}
      {day.deaths.length > 0 && (
        <p className="text-sm text-flare">
          {talk.souls.died}: {day.deaths.map((c) => DEATH_CAUSE_LABELS[c]).join(", ")}
        </p>
      )}
      {day.recovered > 0 && (
        <p className="text-sm text-tier-green">
          Picked up {formatSouls(day.recovered)} {talk.souls.souls}
        </p>
      )}
    </div>
  );
}
