import {
  addDays,
  MAX_GAME_PLAN_LINKS,
  MAX_GAME_PLAN_NOTE,
  MAX_GAME_PLANS,
  statPeriod,
  type GamePlanDto,
  type RatedNodeDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import {
  useCreateGamePlan,
  useDeleteGamePlan,
  useGamePlans,
  useUpdateGamePlan,
} from "../../api/gamePlans";
import { AttributePicker } from "../../components/AttributePicker";
import { Button } from "../../components/Button";
import { DebugId } from "../../components/debug/Debug";
import { compactFieldClass } from "../../components/form";
import { NodeChip } from "../../components/NodeChip";
import { shortDate } from "../../lib/format";
import { useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";

const label = "block text-xs uppercase tracking-wider text-court-300";

/** End-date shortcuts: Game Plans run for weeks or months, not days. */
function endPresets(today: string, seasonEndsOn: string | undefined) {
  const monthEnd = statPeriod("month", today, 1).end;
  return [
    { label: "End of month", date: monthEnd },
    ...(seasonEndsOn && seasonEndsOn !== monthEnd
      ? [{ label: "End of season", date: seasonEndsOn }]
      : []),
    { label: "6 weeks", date: addDays(today, 41) },
    { label: "3 months", date: addDays(today, 89) },
  ];
}

/**
 * Game Plans (DESIGN.md §7.16): what the player is leaning into for a while, with no numbers.
 * The coach, recaps and weekly reviews read them; nothing is scored.
 */
export function GamePlans({
  nodes,
  today,
  seasonEndsOn,
}: {
  nodes: RatedNodeDto[];
  today: string;
  seasonEndsOn?: string;
}) {
  const talk = useTalk();
  const plans = useGamePlans();
  /** "new", a plan id being edited, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const [showEnded, setShowEnded] = useState(false);
  if (plans.isPending) return null;
  if (plans.isError) return <ErrorNote error={plans.error} />;

  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const open = plans.data.filter((p) => p.status !== "ended");
  const ended = plans.data.filter((p) => p.status === "ended");
  const editor = (plan?: GamePlanDto) => (
    <GamePlanEditor
      plan={plan}
      nodes={nodes}
      today={today}
      seasonEndsOn={seasonEndsOn}
      onDone={() => setEditing(null)}
    />
  );
  const card = (p: GamePlanDto) =>
    editing === p.id ? (
      <div key={p.id}>{editor(p)}</div>
    ) : (
      <PlanCard
        key={p.id}
        plan={p}
        names={names}
        busy={editing !== null}
        onEdit={() => setEditing(p.id)}
      />
    );

  return (
    <section className="space-y-3" aria-label={`${talk.gamePlan}s`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-3 font-display text-xl uppercase tracking-wider">
          {talk.gamePlan}
          <span className="text-sm normal-case tracking-normal text-court-500">
            What you're leaning into, no numbers
          </span>
        </h2>
        <Button
          variant="ghost"
          disabled={editing !== null || open.length >= MAX_GAME_PLANS}
          onClick={() => setEditing("new")}
        >
          + New {talk.gamePlan.toLowerCase()}
        </Button>
      </div>
      {editing === "new" && editor()}
      {open.length === 0 && editing !== "new" && (
        <p className="rounded-xl border border-dashed border-court-700 p-4 text-sm text-court-500">
          An emphasis for a while, like "Build strength this winter" or "Get my sleep back on
          track". The coach and your recaps keep it in mind.
        </p>
      )}
      {open.length > 0 && <div className="grid gap-3 md:grid-cols-2">{open.map(card)}</div>}
      {ended.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showEnded}
            onClick={() => setShowEnded((v) => !v)}
            className="text-sm uppercase tracking-wider text-court-500 hover:text-neon"
          >
            Ended ({ended.length}) {showEnded ? "▾" : "▸"}
          </button>
          {showEnded && <div className="grid gap-3 md:grid-cols-2">{ended.map(card)}</div>}
        </>
      )}
    </section>
  );
}

function PlanCard({
  plan: p,
  names,
  busy,
  onEdit,
}: {
  plan: GamePlanDto;
  names: Map<string, string>;
  busy: boolean;
  onEdit: () => void;
}) {
  const remove = useDeleteGamePlan();
  const [confirming, setConfirming] = useState(false);
  return (
    <article
      aria-label={p.name}
      className={`space-y-2 rounded-xl border bg-court-900/70 p-4 ${p.status === "active" ? "border-neon/40" : "border-court-700"}`}
    >
      <div>
        <h3 className="font-medium">
          {p.name}
          <DebugId id={p.id} />
        </h3>
        <p className="text-xs text-court-500">
          {p.status === "upcoming" ? "Starts" : ""} {shortDate(p.startsOn)} – {shortDate(p.endsOn)}
        </p>
      </div>
      {p.note && <p className="text-sm text-court-300">{p.note}</p>}
      {p.links.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {p.links.map((id) => (
            <NodeChip key={id} id={id} name={names.get(id)} />
          ))}
        </span>
      )}
      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-court-800 pt-2">
        {confirming ? (
          <span className="flex items-center gap-1 text-sm text-court-300">
            Delete this?
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(p.id, { onSettled: () => setConfirming(false) })}
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
    </article>
  );
}

function GamePlanEditor({
  plan,
  nodes,
  today,
  seasonEndsOn,
  onDone,
}: {
  plan?: GamePlanDto;
  nodes: RatedNodeDto[];
  today: string;
  seasonEndsOn?: string;
  onDone: () => void;
}) {
  const talk = useTalk();
  const presets = endPresets(today, seasonEndsOn);
  const [name, setName] = useState(plan?.name ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [startsOn, setStartsOn] = useState(plan?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(plan?.endsOn ?? presets[0]!.date);
  const [links, setLinks] = useState<string[]>(plan?.links ?? []);
  const create = useCreateGamePlan();
  const update = useUpdateGamePlan();
  const saving = create.isPending || update.isPending;
  const validWindow = Boolean(startsOn && endsOn && endsOn >= startsOn);

  const toggleLink = (id: string) =>
    setLinks((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_GAME_PLAN_LINKS
          ? [...prev, id]
          : prev,
    );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = { name: name.trim(), note: note.trim(), startsOn, endsOn, links };
    if (plan) update.mutate({ id: plan.id, ...body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={plan ? `Edit ${talk.gamePlan}` : `New ${talk.gamePlan}`}
      className="space-y-5 rounded-xl border border-neon/40 bg-court-900 p-5"
    >
      <label className="block space-y-1">
        <span className={label}>{talk.gamePlan}</span>
        <input
          value={name}
          maxLength={80}
          required
          autoFocus
          placeholder="e.g. Build strength"
          onChange={(e) => setName(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>
      <label className="block space-y-1">
        <span className={label}>What it looks like (optional)</span>
        <textarea
          value={note}
          maxLength={MAX_GAME_PLAN_NOTE}
          rows={2}
          placeholder="e.g. Lifting comes first; cardio can slide a bit."
          onChange={(e) => setNote(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className={label}>Starts</span>
            <input
              type="date"
              aria-label="Starts"
              value={startsOn}
              required
              onChange={(e) => setStartsOn(e.target.value)}
              className={compactFieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Through</span>
            <input
              type="date"
              aria-label="Through"
              value={endsOn}
              min={startsOn}
              required
              onChange={(e) => setEndsOn(e.target.value)}
              className={compactFieldClass}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setEndsOn(p.date)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${endsOn === p.date ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {nodes.length > 0 && (
        <fieldset className="space-y-3">
          <legend className={label}>
            Leans into ({links.length}/{MAX_GAME_PLAN_LINKS})
          </legend>
          <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
        </fieldset>
      )}
      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || !validWindow || saving}>
          {saving ? "Saving…" : plan ? "Save" : `Add ${talk.gamePlan.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
