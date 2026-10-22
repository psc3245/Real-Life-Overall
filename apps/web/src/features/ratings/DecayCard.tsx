import { addDays, BACKFILL_DAYS, MAX_PAUSE_REASON, type PauseDto } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useDay } from "../../api/days";
import { useCreatePause, useEndPause, usePauses, useRunScheduled } from "../../api/pauses";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";

const field =
  "rounded-lg border border-court-700 bg-court-950 px-3 py-2 text-sm outline-none focus:border-neon";

function describe(p: PauseDto) {
  return `${p.startsOn} → ${p.endsOn ?? "until you end it"}${p.reason ? ` · ${p.reason}` : ""}`;
}

/** Explains decay and manages vacation/injury pauses (DESIGN.md §5.4). */
export function DecayCard() {
  const today = useDay(null).data?.today;
  const pauses = usePauses();
  const create = useCreatePause();
  const end = useEndPause();
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  if (!today || !pauses.data) return null;

  const active = pauses.data.find(
    (p) => p.startsOn <= today && (p.endsOn === null || today <= p.endsOn),
  );
  const upcoming = pauses.data.filter((p) => p.startsOn > today);
  const start = startsOn || today;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { startsOn: start, endsOn: endsOn || null, reason: reason.trim() },
      {
        onSuccess: () => {
          setStartsOn("");
          setEndsOn("");
          setReason("");
        },
      },
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-court-700 bg-court-900/70 p-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-wider">Decay & pauses</h2>
        <p className="mt-1 text-sm text-court-300">
          Attributes fade when you go too long without activity: tap one below to see its rule.
          Pause decay while you're on vacation, sick or injured.
        </p>
      </div>

      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tier-yellow/50 bg-tier-yellow/5 p-3">
          <p className="text-sm">
            <span className="font-semibold text-tier-yellow">Decay paused</span> ·{" "}
            {describe(active)}
          </p>
          <Button
            disabled={end.isPending}
            // Ending today means today counts again; a pause that started today disappears.
            onClick={() => end.mutate({ id: active.id, endsOn: addDays(today, -1) })}
          >
            {end.isPending ? "Ending…" : "End pause"}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wider text-court-300">From</span>
            <input
              type="date"
              aria-label="Pause from"
              value={start}
              min={addDays(today, -BACKFILL_DAYS)}
              onChange={(e) => setStartsOn(e.target.value)}
              className={field}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wider text-court-300">
              To (optional)
            </span>
            <input
              type="date"
              aria-label="Pause until"
              value={endsOn}
              min={start}
              onChange={(e) => setEndsOn(e.target.value)}
              className={field}
            />
          </label>
          <label className="min-w-40 flex-1 space-y-1">
            <span className="block text-xs uppercase tracking-wider text-court-300">Reason</span>
            <input
              aria-label="Pause reason"
              value={reason}
              maxLength={MAX_PAUSE_REASON}
              placeholder="Vacation"
              onChange={(e) => setReason(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Pausing…" : "Pause decay"}
          </Button>
        </form>
      )}

      {upcoming.length > 0 && (
        <ul className="space-y-2 text-sm">
          {upcoming.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-court-300">Upcoming: {describe(p)}</span>
              <Button
                variant="ghost"
                disabled={end.isPending}
                onClick={() => end.mutate({ id: p.id, endsOn: addDays(p.startsOn, -1) })}
              >
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorNote error={create.error ?? end.error} />
      {import.meta.env.DEV && <DevScheduler />}
    </section>
  );
}

function DevScheduler() {
  const run = useRunScheduled();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-court-700 pt-3 text-xs text-court-500">
      <span className="uppercase tracking-wider">Dev</span>
      <Button variant="ghost" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "Running…" : "Run 4am job now"}
      </Button>
      {run.data && (
        <span>
          Recapped {run.data.recapped.length ? run.data.recapped.join(", ") : "nothing"} · decayed{" "}
          {run.data.decayDays} day{run.data.decayDays === 1 ? "" : "s"}
          {run.data.failed.length > 0 && ` · failed ${run.data.failed.join(", ")}`}
        </span>
      )}
      <ErrorNote error={run.error} />
    </div>
  );
}
