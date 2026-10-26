import {
  ALL_DAYS,
  GROUP_RULE_LABELS,
  GROUP_RULES,
  HABIT_DIRECTIONS,
  HABIT_TYPE_LABELS,
  HABIT_TYPES,
  MAX_HABIT_LINKS,
  normalizeHabitConfig,
  type HabitConfig,
  type HabitDirection,
  type HabitDto,
  type GroupRule,
  type HabitType,
  type RatedNodeDto,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useCreateHabit, useSuggestLinks, useUpdateHabit } from "../../api/days";
import { AttributePicker } from "../../components/AttributePicker";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { compactFieldClass } from "../../components/form";

/** What "kept" means for an avoid habit, by how it's logged. */
const AVOID_HELP: Partial<Record<HabitType, string>> = {
  checkbox: 'Every day counts as kept until you mark a slip. Mark "Avoided" to report a clean day.',
  checknote: "Every day counts as kept until you mark a slip; add a note about what happened.",
  counter: "Log how many. Staying at or under the limit keeps the day; a limit of 0 means none.",
  duration: "Log the minutes. Staying at or under the limit keeps the day.",
  slider: "Log the level. At or below your line keeps the day.",
  rating: "Log the stars. At or below your line keeps the day.",
  shorttext: "Write down slips only. A day with nothing written counts as kept.",
  journal: "Write down slips only. A day with nothing written counts as kept.",
};

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

  const avoid = config.direction === "avoid";
  const changeType = (next: HabitType) => {
    setType(next);
    setConfig(normalizeHabitConfig(next, { direction: config.direction }));
  };
  const changeDirection = (direction: HabitDirection) =>
    setConfig(normalizeHabitConfig(type, { ...config, direction, target: null }));
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
    className: `${compactFieldClass} w-24`,
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-neon/40 bg-court-900 p-5"
    >
      {type !== "group" && (
        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-wider text-court-300">Goal</legend>
          <div className="flex flex-wrap gap-2">
            {HABIT_DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={(config.direction ?? "build") === d}
                disabled={Boolean(habit)}
                onClick={() => changeDirection(d)}
                className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-60 ${(config.direction ?? "build") === d ? (d === "avoid" ? "border-flare bg-flare/10 text-flare" : "border-neon bg-neon/10 text-neon") : "border-court-700 text-court-300 hover:border-court-500"}`}
              >
                {d === "build" ? "Build: do it" : "Avoid: don't do it"}
              </button>
            ))}
          </div>
          {avoid && (
            <p className="text-sm text-court-500">{AVOID_HELP[type] ?? AVOID_HELP.checkbox}</p>
          )}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">Name</span>
          <input
            value={name}
            maxLength={60}
            required
            autoFocus
            placeholder={
              parent
                ? `e.g. Stretch (in ${parent.name})`
                : avoid
                  ? "e.g. No smoking, Coffee, Social media"
                  : "e.g. Morning run"
            }
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">How you log it</span>
          <select
            value={type}
            disabled={Boolean(habit)}
            onChange={(e) => changeType(e.target.value as HabitType)}
            className={`${compactFieldClass} w-full disabled:opacity-60`}
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
                  {avoid ? "Daily limit (at most)" : "Daily goal"}
                </span>
                <input
                  aria-label={avoid ? "Daily limit" : "Daily goal"}
                  min={avoid ? 0 : 1}
                  {...num("target")}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs uppercase tracking-wider text-court-300">Unit</span>
                <input
                  aria-label="Unit"
                  value={config.unit ?? ""}
                  maxLength={20}
                  placeholder="pages"
                  onChange={(e) => setConfig((c) => ({ ...c, unit: e.target.value }))}
                  className={`${compactFieldClass} w-28`}
                />
              </label>
            </>
          )}
          {type === "duration" && (
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">
                {avoid ? "Daily limit (min)" : "Daily goal (min)"}
              </span>
              <input
                aria-label={avoid ? "Daily limit in minutes" : "Daily goal in minutes"}
                min={avoid ? 0 : 1}
                {...num("target")}
              />
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
          {avoid && (type === "slider" || type === "rating") && (
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">
                Stay at or below
              </span>
              <input aria-label="Stay at or below" {...num("target")} />
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
              className={compactFieldClass}
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
              {WEEKDAY_LETTERS.map((letter, d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  aria-label={WEEKDAY_NAMES[d]}
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
              className={compactFieldClass}
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
          <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
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
