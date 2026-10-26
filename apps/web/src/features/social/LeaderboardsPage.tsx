import {
  LEADERBOARD_BOARDS,
  LEADERBOARD_MIN_RECAPPED_DAYS,
  SEASON_MODES,
  type LeaderboardDto,
  type LeaderboardEntryDto,
  type LeaderboardScope,
  type SeasonMode,
} from "@rlo/shared";
import { Link, useSearchParams } from "react-router";
import { useLeaderboard } from "../../api/social";
import { formatScore, scoreColor } from "../../components/score";
import { useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";
import { DebugJson } from "../../components/debug/Debug";

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1 text-sm ${active ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`;

export function LeaderboardsPage() {
  const talk = useTalk();
  const [params, setParams] = useSearchParams();
  const scope: LeaderboardScope = params.get("scope") === "global" ? "global" : "friends";
  const board = LEADERBOARD_BOARDS.some((b) => b.key === params.get("board"))
    ? params.get("board")!
    : "overall";
  // Rating and growth boards are separate (DESIGN.md §4.6); no choice means your own mode's.
  const chosenMode = SEASON_MODES.find((m) => m === params.get("mode"));
  const leaderboard = useLeaderboard(scope, board, chosenMode);
  const mode = leaderboard.data?.mode ?? chosenMode ?? "rating";
  const set = (changes: Record<string, string>) =>
    setParams(
      { scope, board, ...(chosenMode ? { mode: chosenMode } : {}), ...changes },
      {
        replace: true,
      },
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-bold uppercase">Leaderboards</h1>
        {leaderboard.data && (
          <span className="text-sm uppercase tracking-wider text-court-500">
            Season {leaderboard.data.seasonLabel}
          </span>
        )}
      </div>

      <div role="tablist" aria-label="Scope" className="flex gap-2">
        {(["friends", "global"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => set({ scope: s })}
            className={`flex-1 rounded-lg border py-2 font-display uppercase tracking-wider ${scope === s ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {s === "friends" ? "Friends" : "Global"}
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Mode" className="flex gap-2">
        {SEASON_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => set({ mode: m })}
            className={`flex-1 rounded-lg border py-1.5 text-sm uppercase tracking-wider ${mode === m ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {m === "growth" ? talk.growthMode : talk.ratingMode}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Board">
        {LEADERBOARD_BOARDS.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-pressed={board === b.key}
            onClick={() => set({ board: b.key })}
            className={chip(board === b.key)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {leaderboard.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={leaderboard.error} />
      {leaderboard.data && (
        <>
          {leaderboard.data.myMode && leaderboard.data.myMode !== leaderboard.data.mode ? (
            <p className="rounded-xl border border-court-700 bg-court-900/60 p-4 text-sm text-court-300">
              You're playing{" "}
              {leaderboard.data.myMode === "growth" ? talk.growthMode : talk.ratingMode} this
              season, so you rank on the{" "}
              <button
                type="button"
                onClick={() => set({ mode: leaderboard.data.myMode! })}
                className="text-neon hover:underline"
              >
                {leaderboard.data.myMode === "growth" ? talk.growthMode : talk.ratingMode} board
              </button>
              .
            </p>
          ) : (
            scope === "global" &&
            !leaderboard.data.me && <GlobalStatus status={leaderboard.data.globalStatus} />
          )}
          <Board data={leaderboard.data} />
        </>
      )}
      <DebugJson label="leaderboard" data={leaderboard.data} />
    </div>
  );
}

function Board({ data }: { data: LeaderboardDto }) {
  if (!data.entries.length) {
    return (
      <p className="rounded-xl border border-court-800 p-6 text-center text-court-500">
        {data.scope === "friends"
          ? data.board === "overall"
            ? "Add friends to see how you stack up."
            : "Nobody here has this template category."
          : "Nobody is on this board yet this season."}
      </p>
    );
  }
  const meBelow = data.me && !data.entries.some((e) => e.isMe);
  return (
    <ol className="space-y-2" aria-label="Rankings">
      {data.entries.map((e) => (
        <EntryRow key={e.username} entry={e} mode={data.mode} />
      ))}
      {meBelow && (
        <>
          <li aria-hidden className="text-center text-court-700">
            ⋯
          </li>
          <EntryRow entry={data.me!} mode={data.mode} />
        </>
      )}
    </ol>
  );
}

function EntryRow({ entry, mode }: { entry: LeaderboardEntryDto; mode: SeasonMode }) {
  const color = scoreColor(mode, entry.value);
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border p-3 ${entry.isMe ? "border-neon/60 bg-neon/5" : "border-court-700 bg-court-900/70"}`}
    >
      <span
        className={`w-8 text-center font-display text-2xl tabular-nums ${entry.rank <= 3 ? "text-court-100" : "text-court-500"}`}
      >
        {entry.rank}
      </span>
      <Link to={`/u/${entry.username}`} className="min-w-0 flex-1 hover:text-neon">
        <p className="truncate font-display text-lg uppercase">
          {entry.displayName}
          {entry.isMe && <span className="ml-2 text-xs text-neon">You</span>}
        </p>
        <p className="truncate text-sm text-court-500">
          {entry.archetype ?? `@${entry.username}`}
          {entry.provisional && (
            <span
              className="ml-2 rounded border border-court-700 px-1.5 text-xs uppercase"
              title={`Fewer than ${LEADERBOARD_MIN_RECAPPED_DAYS} recapped days this season`}
            >
              Provisional
            </span>
          )}
        </p>
      </Link>
      <span className="font-display text-3xl font-semibold tabular-nums" style={{ color }}>
        {formatScore(mode, entry.value)}
      </span>
    </li>
  );
}

/** What stands between you and the global board. */
function GlobalStatus({ status }: { status: LeaderboardDto["globalStatus"] }) {
  const steps: string[] = [];
  if (status.visibility !== "public") steps.push("Make your profile public.");
  if (!status.optedIn) steps.push("Opt in to global leaderboards.");
  if (!status.hasCard) steps.push("Finish onboarding to get a rating.");
  if (status.reasons.includes("few-recaps")) {
    steps.push(
      `Recap at least ${LEADERBOARD_MIN_RECAPPED_DAYS} days this season (you have ${status.recappedDays}).`,
    );
  }
  if (status.reasons.includes("flagged")) {
    steps.push(
      "Many of your recaps had claims the model flagged as implausible or unclear. Log specifics to get back on.",
    );
  }
  if (!steps.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-court-700 bg-court-900/60 p-4 text-sm">
      <p className="font-display uppercase tracking-wider text-court-300">
        You're not on this board
      </p>
      <ul className="list-disc space-y-1 pl-5 text-court-300">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {(status.visibility !== "public" || !status.optedIn) && (
        <Link to="/settings" className="inline-block text-neon hover:underline">
          Sharing settings →
        </Link>
      )}
    </div>
  );
}
