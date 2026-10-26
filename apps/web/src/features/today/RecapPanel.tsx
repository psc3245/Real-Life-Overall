import { MAX_RECAPS_PER_DAY, type DayDto, type RecapDto } from "@rlo/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useEndDay } from "../../api/days";
import { Button } from "../../components/Button";
import { EarnedBadges } from "../../components/BadgeChip";
import { Delta } from "../../components/Delta";
import { useRecapDebug } from "../../api/admin";
import { DebugFacts, DebugJson } from "../../components/debug/Debug";
import { useDebug } from "../../components/debug/debugMode";
import { ErrorNote } from "../onboarding/ErrorNote";

const WORKING = ["Reading your day…", "Weighing the evidence…", "Updating your ratings…"];

/** Mirrors the API's check (recap-service hasContent). */
function hasContent(day: DayDto) {
  return (
    day.journal.trim() !== "" ||
    day.habits.some((h) => h.entry || h.children?.some((c) => c.entry)) ||
    day.objectives.some((o) => o.logged !== null) ||
    day.workouts.length > 0 ||
    day.prompts.some((p) => p.answer?.trim())
  );
}

/** "End my day" before a recap; the recap itself after, with an update button if stale. */
export function RecapPanel({ day }: { day: DayDto }) {
  const endDay = useEndDay(day.date);
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!endDay.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING.length), 2500);
    return () => clearInterval(timer);
  }, [endDay.isPending]);

  const ready = hasContent(day);
  const action = (label: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        className="px-6 py-3 text-base"
        disabled={!ready || !day.editable || endDay.isPending}
        onClick={() => endDay.mutate()}
      >
        {endDay.isPending ? WORKING[line] : label}
      </Button>
      {!ready && <span className="text-sm text-court-500">Log something first.</span>}
      <ErrorNote error={endDay.error} />
    </div>
  );

  if (!day.recap) {
    return (
      <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
        <h2 className="font-display text-xl uppercase tracking-wider">Recap</h2>
        <p className="text-sm text-court-300">
          When you're done for the day, the scout reviews what you logged and moves your ratings.
        </p>
        {day.editable ? (
          action("End my day")
        ) : (
          <p className="text-sm text-court-500">Not recapped.</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {day.status === "stale" && day.editable && (
        <div className="space-y-3 rounded-xl border border-tier-yellow/50 bg-tier-yellow/5 p-4">
          <p className="text-sm text-court-100">
            You've changed this day since its recap. Update it to re-score the day (up to{" "}
            {MAX_RECAPS_PER_DAY} recaps per day).
          </p>
          {action("Update recap")}
        </div>
      )}
      <RecapCard recap={day.recap} />
      <RecapDebug recapId={day.recap.id} />
    </section>
  );
}

/** Admins: the stored model output, prompt version, re-runs and the LLM call behind it. */
function RecapDebug({ recapId }: { recapId: string }) {
  const debug = useDebug();
  const data = useRecapDebug(recapId, debug);
  const d = data.data;
  return (
    <DebugJson label="recap model output" data={d?.output}>
      {data.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={data.error} />
      {d && (
        <DebugFacts
          facts={{
            id: d.id.slice(0, 8),
            prompt: d.promptVersion,
            status: d.status,
            runs: d.runs.length,
            ...(d.calls[0] && {
              model: d.calls[0].model,
              tokens: `${d.calls[0].inputTokens ?? "?"}/${d.calls[0].outputTokens ?? "?"}`,
              ms: d.calls[0].latencyMs.toLocaleString(),
              cost: d.calls[0].costUsd !== null ? `$${d.calls[0].costUsd.toFixed(5)}` : "—",
            }),
          }}
        />
      )}
    </DebugJson>
  );
}

export function RecapCard({ recap }: { recap: RecapDto }) {
  const { overallBefore: before, overallAfter: after } = recap;
  return (
    <article className="space-y-4 rounded-xl border border-neon/40 bg-court-900 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wider text-neon">Day recap</h2>
        {before !== null && after !== null && (
          <p className="font-display text-lg tabular-nums text-court-300">
            OVR {before.toFixed(1)} → <span className="text-court-100">{after.toFixed(1)}</span>{" "}
            {Math.abs(after - before) >= 0.05 && (
              <Delta value={after - before} className="text-base" />
            )}
          </p>
        )}
      </header>
      <p className="text-court-100">{recap.narrative}</p>
      <EarnedBadges badges={recap.badges} />
      {recap.changes.length > 0 ? (
        <ul className="divide-y divide-court-800">
          {recap.changes.map((c) => (
            <li key={c.nodeId} className="grid grid-cols-[4rem_1fr] gap-3 py-2.5">
              <Delta value={c.delta} className="text-lg" />
              <div className="min-w-0">
                <p className="font-medium">
                  <Link to={`/ratings/node/${c.nodeId}`} className="hover:text-neon">
                    {c.nodeName}
                  </Link>{" "}
                  <span className="text-sm text-court-500 tabular-nums">
                    → {c.valueAfter.toFixed(1)}
                  </span>
                </p>
                <p className="text-sm text-court-300">{c.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-court-500">No rating changes from this day.</p>
      )}
      {recap.flags.length > 0 && (
        <div className="rounded-lg bg-court-950/60 p-3 text-sm text-court-300">
          <p className="mb-1 text-xs uppercase tracking-wider text-court-500">Scout's notes</p>
          <ul className="list-disc space-y-1 pl-4">
            {recap.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
