import { OBJECTIVE_TERM_LABELS, type ObjectiveDto, type ObjectiveTerm } from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useDay, useHabits } from "../../api/days";
import { useMe } from "../../api/hooks";
import { useDeleteObjective, useObjectives } from "../../api/objectives";
import { useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { NodeChip } from "../../components/NodeChip";
import { shortDate } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ObjectiveEditor } from "./ObjectiveEditor";
import {
  ObjectiveAmount,
  ObjectiveBar,
  objectiveStatusText,
  statusTone,
} from "./ObjectiveProgress";
import { DebugId, DebugJson } from "../../components/debug/Debug";
import { ChartLink } from "../charts/ChartLink";

const TERM_DETAIL: Record<ObjectiveTerm, string> = {
  short: "A month or less",
  long: "Longer than a month",
};

/** Goals with a deadline: short and long term, then finished ones. */
export function GoalsPage() {
  const objectives = useObjectives();
  const habits = useHabits();
  const ratings = useRatings();
  const me = useMe();
  const today = useDay(null).data?.today;
  /** "new", a goal id being edited, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  if (objectives.isPending || habits.isPending || !me.data || !today)
    return <p className="pt-10 text-court-500">Loading…</p>;
  if (objectives.isError) return <ErrorNote error={objectives.error} />;

  const nodes = ratings.data?.nodes ?? [];
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const all = objectives.data;
  const open = all.filter(
    (o) => o.progress.status === "active" || o.progress.status === "upcoming",
  );
  const finished = all
    .filter((o) => o.progress.status === "completed" || o.progress.status === "missed")
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn));
  const editor = (objective?: ObjectiveDto) => (
    <ObjectiveEditor
      objective={objective}
      habits={habits.data ?? []}
      nodes={nodes}
      today={today}
      weekStart={me.data.weekStart}
      onDone={() => setEditing(null)}
    />
  );
  const card = (o: ObjectiveDto) =>
    editing === o.id ? (
      <div key={o.id}>{editor(o)}</div>
    ) : (
      <GoalCard
        key={o.id}
        objective={o}
        names={names}
        busy={editing !== null}
        onEdit={() => setEditing(o.id)}
      />
    );

  return (
    <div className="space-y-8 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Targets with a deadline</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Goals</h1>
        </div>
        <Button variant="primary" disabled={editing !== null} onClick={() => setEditing("new")}>
          + New goal
        </Button>
      </header>

      {editing === "new" && editor()}

      {all.length === 0 && editing !== "new" && (
        <div className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-300">
          <p>No goals yet.</p>
          <p className="mt-1 text-sm text-court-500">
            Something like "Run 100 miles before New Year's" or "Gym 3 times this week". Log
            progress on the goal each day, or have it count one of your habits.
          </p>
        </div>
      )}

      {(["short", "long"] as const).map((term) => {
        const goals = open.filter((o) => o.term === term);
        if (!goals.length) return null;
        return (
          <section key={term} className="space-y-3" aria-label={OBJECTIVE_TERM_LABELS[term]}>
            <h2 className="flex items-baseline gap-3 font-display text-xl uppercase tracking-wider">
              {OBJECTIVE_TERM_LABELS[term]}
              <span className="text-sm normal-case tracking-normal text-court-500">
                {TERM_DETAIL[term]}
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">{goals.map(card)}</div>
          </section>
        );
      })}

      {finished.length > 0 && (
        <section className="space-y-3" aria-label="Finished">
          <button
            type="button"
            aria-expanded={showFinished}
            onClick={() => setShowFinished((v) => !v)}
            className="font-display text-xl uppercase tracking-wider text-court-300 hover:text-neon"
          >
            Finished ({finished.filter((o) => o.progress.status === "completed").length}/
            {finished.length} reached) {showFinished ? "▾" : "▸"}
          </button>
          {showFinished && <div className="grid gap-3 md:grid-cols-2">{finished.map(card)}</div>}
        </section>
      )}
    </div>
  );
}

function GoalCard({
  objective: o,
  names,
  busy,
  onEdit,
}: {
  objective: ObjectiveDto;
  names: Map<string, string>;
  busy: boolean;
  onEdit: () => void;
}) {
  const remove = useDeleteObjective();
  const [confirming, setConfirming] = useState(false);
  const p = o.progress;
  const done = p.status === "completed";

  return (
    <article
      aria-label={o.name}
      className={`space-y-3 rounded-xl border bg-court-900/70 p-4 ${done ? "border-neon/50" : "border-court-700"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">
            {done && <span className="mr-1.5 text-neon">✓</span>}
            {o.name}
            <DebugId id={o.id} />
          </h3>
          <p className="text-xs text-court-500">
            {shortDate(o.startsOn)} – {shortDate(o.endsOn)}
            {o.habitName && ` · counts ${o.habitName}`}
          </p>
        </div>
        <p className="font-display text-2xl">
          <ObjectiveAmount objective={o} />
        </p>
      </div>
      <ObjectiveBar objective={o} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={statusTone(o)}>{objectiveStatusText(o)}</span>
        {o.links.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {o.links.map((id) => (
              <NodeChip key={id} id={id} name={names.get(id)} />
            ))}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-court-800 pt-2">
        {p.status === "active" && (
          <Link
            to={o.source === "workouts" ? "/workouts" : `/log#goal-${o.id}`}
            className="mr-auto text-sm text-neon hover:underline"
          >
            {o.source === "manual"
              ? "Log today →"
              : o.source === "workouts"
                ? "Start a workout →"
                : `Log ${o.habitName ?? "the habit"} →`}
          </Link>
        )}
        <ChartLink
          ids={[`goal:${o.id}`]}
          config={{ range: "all" }}
          className="px-2 text-sm text-court-300 hover:text-neon"
        />
        {confirming ? (
          <span className="flex items-center gap-1 text-sm text-court-300">
            Delete this goal?
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(o.id, { onSettled: () => setConfirming(false) })}
            >
              {remove.isPending ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
      <ErrorNote error={remove.error} />
      <DebugJson label="goal" data={o} />
    </article>
  );
}
