import {
  ALL_DAYS,
  GROUP_RULE_LABELS,
  GROUP_RULES,
  HABIT_TYPE_LABELS,
  HABIT_TYPES,
  leafIds,
  MAX_HABIT_LINKS,
  normalizeHabitConfig,
  type HabitConfig,
  type HabitDto,
  type GroupRule,
  type HabitType,
  type RatedNodeDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useCreateHabit, useSuggestLinks, useUpdateHabit } from "../../api/days";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const field =
  "rounded-lg border border-court-700 bg-court-950 px-3 py-2 text-sm outline-none focus:border-neon";

export function HabitEditor({
  habit,
  parent,
  nodes,
  today,
  onDone,
}: {
  /** Omit to create a new habit. */
  habit?: HabitDto;
  /** The group a new (or edited) sub-habit belongs to; it takes the group's schedule. */
  parent?: HabitDto;
  nodes: RatedNodeDto[];
  /** The user's local date, the default start date. */
  today: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [type, setType] = useState<HabitType>(habit?.type ?? "checkbox");
  const [config, setConfig] = useState<HabitConfig>(
    habit?.config ?? normalizeHabitConfig("checkbox"),
  );
  const [days, setDays] = useState<number[]>(habit?.days ?? ALL_DAYS);
  const [links, setLinks] = useState<string[]>(habit?.links ?? []);
  const [startsOn, setStartsOn] = useState(habit?.startsOn ?? today);
  const [reason, setReason] = useState<string | null>(null);
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const suggest = useSuggestLinks();
  const saving = create.isPending || update.isPending;

  const leaves = new Set(leafIds(nodes));
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const leavesUnder = (id: string): RatedNodeDto[] =>
    leaves.has(id)
      ? nodes.filter((n) => n.id === id)
      : nodes.filter((n) => n.parentId === id).flatMap((c) => leavesUnder(c.id));

  const changeType = (next: HabitType) => {
    setType(next);
    setConfig(normalizeHabitConfig(next));
  };
  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  const toggleLink = (id: string) =>
    setLinks((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_HABIT_LINKS
          ? [...prev, id]
          : prev,
    );
  const runSuggest = () =>
    suggest.mutate(
      { name: name.trim(), type },
      {
        onSuccess: (s) => {
          setLinks(s.nodeIds.slice(0, MAX_HABIT_LINKS));
          setReason(s.reason);
        },
      },
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      name: name.trim(),
      config,
      ...(!parent && { days, startsOn }),
      links: type === "group" ? [] : links,
    };
    if (habit) update.mutate({ id: habit.id, ...body }, { onSuccess: onDone });
    else
      create.mutate(
        { days, startsOn, ...body, type, ...(parent && { parentId: parent.id }) },
        { onSuccess: onDone },
      );
  };

  const num = (key: keyof HabitConfig) => ({
    type: "number" as const,
    value: (config[key] as number | null) ?? "",
    onChange: (e: { target: { valueAsNumber: number } }) =>
      setConfig((c) => ({
        ...c,
        [key]: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null,
      })),
    className: `${field} w-24`,
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-neon/40 bg-court-900 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">Name</span>
          <input
            value={name}
            maxLength={60}
            required
            autoFocus
            placeholder={parent ? `e.g. Stretch (in ${parent.name})` : "e.g. Morning run"}
            onChange={(e) => setName(e.target.value)}
            className={`${field} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">How you log it</span>
          <select
            value={type}
            disabled={Boolean(habit)}
            onChange={(e) => changeType(e.target.value as HabitType)}
            className={`${field} w-full disabled:opacity-60`}
          >
            {HABIT_TYPES.filter((t) => !parent || t !== "group").map((t) => (
              <option key={t} value={t}>
                {HABIT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(type === "counter" || type === "duration" || type === "slider" || type === "rating") && (
        <div className="flex flex-wrap items-end gap-4 text-sm">
          {type === "counter" && (
            <>
              <label className="space-y-1">
                <span className="block text-xs uppercase tracking-wider text-court-300">
                  Daily goal
                </span>
                <input aria-label="Daily goal" min={1} {...num("target")} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs uppercase tracking-wider text-court-300">Unit</span>
                <input
                  aria-label="Unit"
                  value={config.unit ?? ""}
                  maxLength={20}
                  placeholder="pages"
                  onChange={(e) => setConfig((c) => ({ ...c, unit: e.target.value }))}
                  className={`${field} w-28`}
                />
              </label>
            </>
          )}
          {type === "duration" && (
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">
                Daily goal (min)
              </span>
              <input aria-label="Daily goal in minutes" min={1} {...num("target")} />
            </label>
          )}
          {type === "slider" && (
            <>
              <label className="space-y-1">
                <span className="block text-xs uppercase tracking-wider text-court-300">From</span>
                <input aria-label="Scale minimum" {...num("min")} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs uppercase tracking-wider text-court-300">To</span>
                <input aria-label="Scale maximum" {...num("max")} />
              </label>
            </>
          )}
          {type === "rating" && (
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">Stars</span>
              <input aria-label="Number of stars" min={3} max={10} {...num("max")} />
            </label>
          )}
        </div>
      )}

      {type === "group" && (
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wider text-court-300">Done when</span>
            <select
              aria-label="Done when"
              value={config.rule ?? "all"}
              onChange={(e) =>
                setConfig(
                  normalizeHabitConfig("group", { ...config, rule: e.target.value as GroupRule }),
                )
              }
              className={field}
            >
              {GROUP_RULES.map((r) => (
                <option key={r} value={r}>
                  {GROUP_RULE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {config.rule === "count" && (
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">N</span>
              <input aria-label="Sub-habits needed" min={1} {...num("target")} />
            </label>
          )}
          <p className="basis-full text-court-500">
            Add sub-habits after saving. They follow this schedule; link attributes on them.
          </p>
        </div>
      )}

      {parent ? (
        <p className="text-sm text-court-500">
          Part of <span className="text-court-100">{parent.name}</span>, so it follows that group's
          schedule.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-6">
          <fieldset className="space-y-2">
            <legend className="text-xs uppercase tracking-wider text-court-300">
              Scheduled on
            </legend>
            <div className="flex gap-1.5">
              {DAY_LETTERS.map((letter, d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={`h-9 w-9 rounded-full border text-sm font-semibold ${
                    days.includes(d)
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-court-700 text-court-500"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="space-y-2">
            <span className="block text-xs uppercase tracking-wider text-court-300">Starts on</span>
            <input
              type="date"
              aria-label="Starts on"
              value={startsOn}
              required
              onChange={(e) => setStartsOn(e.target.value)}
              className={field}
            />
          </label>
        </div>
      )}
      {!parent && startsOn < today && (
        <p className="-mt-3 text-sm text-court-500">
          Backdated: you can log it on past days, within the 3-day backfill window.
        </p>
      )}

      {type !== "group" && (
        <fieldset className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-xs uppercase tracking-wider text-court-300">
              Builds these attributes ({links.length}/{MAX_HABIT_LINKS})
            </legend>
            <Button
              variant="ghost"
              disabled={!name.trim() || suggest.isPending}
              onClick={runSuggest}
            >
              {suggest.isPending ? "Thinking…" : "✦ Suggest"}
            </Button>
          </div>
          {reason && (
            <p className="border-l-2 border-neon/60 pl-3 text-sm text-court-300">{reason}</p>
          )}
          <ErrorNote error={suggest.error} />
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 shrink-0 truncate text-xs uppercase tracking-wider text-court-500">
                  {c.name}
                </span>
                {leavesUnder(c.id).map((leaf) => (
                  <button
                    key={leaf.id}
                    type="button"
                    aria-pressed={links.includes(leaf.id)}
                    onClick={() => toggleLink(leaf.id)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      links.includes(leaf.id)
                        ? "border-neon bg-neon/15 text-neon"
                        : "border-court-700 text-court-300 hover:border-court-500"
                    }`}
                  >
                    {leaf.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || days.length === 0 || !startsOn || saving}
        >
          {saving
            ? "Saving…"
            : habit
              ? "Save habit"
              : parent
                ? "Add sub-habit"
                : type === "group"
                  ? "Add group"
                  : "Add habit"}
        </Button>
      </div>
    </form>
  );
}
