import {
  BOSS_SOULS_BASE,
  DEATH_CAUSE_LABELS,
  formatSouls,
  SOFT_CAPS,
  SOULS_PER_HABIT,
  SOULS_PER_POINT,
  SOULS_PER_WORKOUT,
  STAT_LEVEL_MAX,
  type SoulDayDto,
  type SoulsDto,
  type SoulStatDto,
} from "@rlo/shared";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import { useLevelUp, useSouls } from "../../api/souls";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { OvrBadge } from "../../components/OvrBadge";
import { HiddenRating, ScoreProvider } from "../../components/score";
import { StatBar } from "../../components/StatBar";
import { dayLabel } from "../../lib/format";
import { cap, useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Souls mode's level-up screen (DESIGN.md §4.7): souls held, the bloodstain, every stat. */
export function BonfirePage() {
  const talk = useTalk();
  const souls = useSouls();

  if (souls.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (souls.error instanceof ApiError && souls.error.status === 404) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">
          No {talk.souls.bonfire.toLowerCase()} here
        </p>
        <p className="mt-2 text-court-300">
          This season isn't a {talk.souls.mode} season. You can pick {talk.souls.mode} when a new
          season starts.
        </p>
        <Link to="/ratings" className="mt-4 inline-block text-neon hover:underline">
          Back to your rating →
        </Link>
      </div>
    );
  }
  if (souls.isError) return <ErrorNote error={souls.error} />;

  const data = souls.data;
  const root = data.stats.find((s) => s.parentId === null);
  return (
    <ScoreProvider mode="souls" values={[]}>
      <div className="space-y-10 pt-4">
        <header className="flex flex-wrap items-center gap-6">
          {data.soulLevel !== null && <OvrBadge value={data.soulLevel} mode="souls" />}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-4xl font-bold uppercase">{talk.souls.bonfire}</h1>
            <p className="text-court-300">{talk.souls.bonfireTagline}.</p>
            {root && <HiddenRating rating={root.rating} />}
          </div>
          <div className="text-right">
            <p className="font-display text-5xl font-bold tabular-nums text-neon">
              {formatSouls(Math.max(0, data.held))}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-court-300">
              {talk.souls.souls} held
            </p>
          </div>
        </header>

        <Warnings data={data} />
        <Stats data={data} />
        <RunLog days={data.days} />
        <Rules />
        <DebugJson label="GET /souls" data={data} />
      </div>
    </ScoreProvider>
  );
}

function Warnings({ data }: { data: SoulsDto }) {
  const talk = useTalk();
  return (
    <>
      {data.bloodstain && (
        <section
          role="status"
          className="rounded-xl border border-flare/50 bg-flare/10 p-5 text-court-100"
        >
          <p className="font-display text-xl uppercase tracking-wider text-flare">
            {talk.souls.bloodstain}: {formatSouls(data.bloodstain.amount)} {talk.souls.souls}
          </p>
          <p className="mt-1 text-sm text-court-300">
            Dropped {dayLabel(data.bloodstain.date)}. End a day with no slips and no setback to pick
            them back up. Die again first and they're gone for good.
          </p>
        </section>
      )}
      {data.held < 0 && (
        <p className="rounded-lg border border-court-700 bg-court-900/70 px-4 py-3 text-sm text-court-300">
          You owe {formatSouls(-data.held)} {talk.souls.souls}: a level was bought with{" "}
          {talk.souls.souls} a later {talk.souls.died.toLowerCase()} took back. New{" "}
          {talk.souls.souls} pay it off first.
        </p>
      )}
    </>
  );
}

function Stats({ data }: { data: SoulsDto }) {
  const root = data.stats.find((s) => s.parentId === null);
  const childrenOf = (id: string) => data.stats.filter((s) => s.parentId === id);
  const leafRows = (node: SoulStatDto): SoulStatDto[] => {
    const kids = childrenOf(node.id);
    return kids.length ? kids.flatMap(leafRows) : [node];
  };
  return (
    <section aria-label="Stats" className="grid gap-6 md:grid-cols-2">
      {(root ? childrenOf(root.id) : []).map((category) => (
        <div
          key={category.id}
          className="space-y-4 rounded-xl border border-court-700 bg-court-900/70 p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl uppercase tracking-wider">{category.name}</h2>
            {category.level !== null && (
              <span className="font-display text-xl tabular-nums text-court-300">
                {category.level.toFixed(1)}
              </span>
            )}
          </div>
          {leafRows(category).map((stat) => (
            <StatRow key={stat.id} stat={stat} held={data.held} />
          ))}
        </div>
      ))}
    </section>
  );
}

function StatRow({ stat, held }: { stat: SoulStatDto; held: number }) {
  const talk = useTalk();
  const levelUp = useLevelUp();
  if (stat.level === null) return null;
  const capped = [...SOFT_CAPS].reverse().find((c) => stat.level! >= c.level);
  const affordable = stat.cost !== null && stat.cost <= held;
  return (
    <div className="space-y-2">
      <StatBar label={stat.name} value={stat.level} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-court-500">
        <span>
          {stat.gained > 0 && (
            <span className="text-tier-green">+{stat.gained} this season · </span>
          )}
          {stat.cost === null
            ? `Maxed at ${STAT_LEVEL_MAX}`
            : `Next level ${formatSouls(stat.cost)} ${talk.souls.souls}`}
          {capped && ` · past the ${capped.level} soft cap`}
        </span>
        {stat.cost !== null && (
          <Button
            variant={affordable ? "primary" : "secondary"}
            className="px-3 py-1 text-xs"
            disabled={!affordable || levelUp.isPending}
            onClick={() => levelUp.mutate({ nodeId: stat.id })}
            aria-label={`${talk.souls.levelUp} ${stat.name}`}
          >
            {talk.souls.levelUp}
          </Button>
        )}
      </div>
      {levelUp.isError && <ErrorNote error={levelUp.error} />}
    </div>
  );
}

function RunLog({ days }: { days: SoulDayDto[] }) {
  const talk = useTalk();
  const shown = days.slice(0, 14);
  return (
    <section aria-labelledby="run-log" className="space-y-3">
      <h2 id="run-log" className="font-display text-2xl uppercase tracking-wider">
        The run
      </h2>
      <ol className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
        {shown.map((d) => {
          const parts = [
            ["recap", d.earned.recap],
            ["weekly review", d.earned.weekly],
            ["habits", d.earned.habits],
            ["workouts", d.earned.workouts],
            [talk.souls.boss.toLowerCase(), d.earned.bosses],
          ].filter(([, n]) => n !== 0) as [string, number][];
          const earned = parts.reduce((s, [, n]) => s + n, 0);
          return (
            <li key={d.date} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-court-100">
                  {dayLabel(d.date)}
                  {d.open && <span className="ml-2 text-xs text-court-500">in play</span>}
                  {d.paused && <span className="ml-2 text-xs text-court-500">paused</span>}
                </p>
                {parts.length > 0 && (
                  <p className="text-xs text-court-500">
                    {parts.map(([k, n]) => `${n > 0 ? "+" : ""}${formatSouls(n)} ${k}`).join(" · ")}
                  </p>
                )}
                {d.deaths.length > 0 && (
                  <p className="text-sm text-flare">
                    {talk.souls.died}: {d.deaths.map((c) => DEATH_CAUSE_LABELS[c]).join(", ")}
                  </p>
                )}
                {d.recovered > 0 && (
                  <p className="text-sm text-tier-green">
                    Picked up {formatSouls(d.recovered)} {talk.souls.souls}
                  </p>
                )}
                {d.lost > 0 && (
                  <p className="text-sm text-court-500">
                    Lost {formatSouls(d.lost)} {talk.souls.souls} for good
                  </p>
                )}
              </div>
              <div className="text-right text-sm tabular-nums">
                <p className={earned > 0 ? "text-neon" : "text-court-500"}>
                  {earned > 0 ? "+" : ""}
                  {formatSouls(earned)}
                </p>
                {d.spent > 0 && <p className="text-court-500">−{formatSouls(d.spent)} spent</p>}
                {d.dropped > 0 && <p className="text-flare">{formatSouls(d.dropped)} dropped</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Rules() {
  const talk = useTalk();
  const s = talk.souls.souls;
  return (
    <details className="rounded-xl border border-court-700 bg-court-900/70 p-5 text-sm text-court-300">
      <summary className="cursor-pointer font-display text-lg uppercase tracking-wider text-court-100">
        How {talk.souls.mode} works
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>
          {cap(s)} come from each day: {SOULS_PER_POINT} per rating point the recap gives,{" "}
          {SOULS_PER_HABIT} per habit done, {SOULS_PER_WORKOUT} per workout, and at least{" "}
          {BOSS_SOULS_BASE} for every goal you beat (longer goals pay more). Weekly reviews can add
          or take back {s}.
        </li>
        <li>
          Spend {s} to raise any attribute one level, up to {STAT_LEVEL_MAX}. Each level costs more
          than the last, and more again past levels {SOFT_CAPS.map((c) => c.level).join(" and ")}.
          Levels never fade.
        </li>
        <li>
          A day with nothing logged, a slip on an avoid habit, or a setback day drops all your
          unspent {s} as a {talk.souls.bloodstain.toLowerCase()}. End your next day cleanly to pick
          it back up; die again first and it's gone. Pauses protect you.
        </li>
        <li>Your rating keeps running underneath, the same as other seasons.</li>
      </ul>
    </details>
  );
}
