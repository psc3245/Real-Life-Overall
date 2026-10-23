import {
  addDays,
  BACKFILL_DAYS,
  groupProgress,
  isDayHabitDone,
  isHabitDone,
  MAX_DAY_JOURNAL,
  type DayDto,
  type DayHabitDto,
  type RatedNodeDto,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useDay, useSaveEntry, useSaveJournal } from "../../api/days";
import { useRatings } from "../../api/ratings";
import { DayPicker } from "../../components/DayPicker";
import { SectionNav } from "../../components/SectionNav";
import { useHashScroll } from "../../components/useHashScroll";
import { NodeChip } from "../../components/NodeChip";
import { ErrorNote } from "../onboarding/ErrorNote";
import { GuidedPrompts } from "./GuidedPrompts";
import { HabitEntryInput } from "./HabitEntryInput";
import { RecapPanel } from "./RecapPanel";
import { weekdayDate } from "../../lib/format";

function dayTitle(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return weekdayDate(date);
}

/** Logging one day: guided prompts, journal, habits and the recap. `?date=` picks a past day. */
export function LogPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date");
  const day = useDay(date);
  const ratings = useRatings();
  useHashScroll(day.isSuccess);

  if (ratings.data === null) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Build your rating first</p>
        <p className="mt-2 text-court-300">Daily logging moves ratings you don't have yet.</p>
        <Link to="/onboarding" className="mt-4 inline-block text-neon hover:underline">
          Start onboarding →
        </Link>
      </div>
    );
  }
  if (day.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (day.isError) return <ErrorNote error={day.error} />;

  const d = day.data;
  const go = (target: string) => setParams(target === d.today ? {} : { date: target });

  return (
    <div className="space-y-8 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/today" className="text-sm text-court-300 hover:text-neon">
            ← Today at a glance
          </Link>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Day log</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
            {dayTitle(d.date, d.today)}
          </h1>
        </div>
        <nav className="flex items-center gap-2" aria-label="Change day">
          <DayPicker today={d.today} selected={d.date} />
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(addDays(d.date, -1))}
            className="h-10 w-10 rounded-lg border border-court-700 text-court-100 hover:border-neon disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next day"
            disabled={d.date >= d.today}
            onClick={() => go(addDays(d.date, 1))}
            className="h-10 w-10 rounded-lg border border-court-700 text-court-100 hover:border-neon disabled:opacity-30"
          >
            →
          </button>
        </nav>
      </header>
      {!d.editable && (
        <p className="rounded-lg border border-court-700 px-3 py-2 text-sm text-court-300">
          This day is past the {BACKFILL_DAYS}-day backfill window, so it's read-only.
        </p>
      )}

      <SectionNav
        sections={[
          ...(d.prompts.length ? [{ id: "questions", label: "Questions" }] : []),
          { id: "journal-section", label: "Journal" },
          { id: "habits", label: "Habits" },
          { id: "recap", label: "Recap" },
        ]}
      />
      <div id="questions" className="scroll-mt-16">
        <GuidedPrompts key={`prompts-${d.date}-${d.prompts.length}`} day={d} />
      </div>
      <div id="journal-section" className="scroll-mt-16">
        <Journal key={d.date} day={d} />
      </div>
      <div id="habits" className="scroll-mt-16">
        <Habits day={d} leaves={ratings.data?.nodes ?? []} />
      </div>
      <div id="recap" className="scroll-mt-16">
        <RecapPanel day={d} />
      </div>
    </div>
  );
}

function Journal({ day }: { day: DayDto }) {
  const save = useSaveJournal(day.date);
  const [text, setText] = useState(day.journal);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(value, { onSuccess: () => setDirty(false) }), 800);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor="journal" className="font-display text-xl uppercase tracking-wider">
          Journal
        </label>
        <span aria-live="polite" className="text-xs uppercase tracking-wider text-court-500">
          {save.isError ? "Not saved" : dirty ? "Saving…" : text ? "Saved" : ""}
        </span>
      </div>
      <textarea
        id="journal"
        value={text}
        rows={6}
        maxLength={MAX_DAY_JOURNAL}
        disabled={!day.editable}
        onChange={(e) => onChange(e.target.value)}
        placeholder="How did the day go? What did you work on, what got in the way, what went well?"
        className="w-full scroll-mt-16 rounded-xl border border-court-700 bg-court-900/70 p-4 leading-relaxed outline-none focus:border-neon"
      />
      <ErrorNote error={save.error} />
    </section>
  );
}

function Habits({ day, leaves }: { day: DayDto; leaves: RatedNodeDto[] }) {
  const names = new Map(leaves.map((n) => [n.id, n.name]));
  const scheduled = day.habits.filter((h) => h.scheduled);
  const bonus = day.habits.filter((h) => !h.scheduled);
  const done = scheduled.filter(isDayHabitDone);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider">
          Habits{" "}
          {scheduled.length > 0 && (
            <span className="text-court-500 tabular-nums">
              {done.length}/{scheduled.length}
            </span>
          )}
        </h2>
        <Link to="/habits/manage" className="text-sm text-court-300 hover:text-neon">
          Manage habits →
        </Link>
      </div>
      {day.habits.length === 0 && (
        <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
          No habits yet.{" "}
          <Link to="/habits/manage" className="text-neon hover:underline">
            Add one
          </Link>{" "}
          to log alongside your journal.
        </p>
      )}
      <div className="space-y-3">
        {scheduled.map((h) => (
          <HabitItem key={`${day.date}-${h.habit.id}`} item={h} day={day} names={names} />
        ))}
      </div>
      {bonus.length > 0 && (
        <>
          <p className="pt-2 text-xs uppercase tracking-wider text-court-500">
            Not scheduled today
          </p>
          <div className="space-y-3 opacity-80">
            {bonus.map((h) => (
              <HabitItem key={`${day.date}-${h.habit.id}`} item={h} day={day} names={names} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** A habit row, or a group with its sub-habits indented below. */
function HabitItem(props: { item: DayHabitDto; day: DayDto; names: Map<string, string> }) {
  const { item } = props;
  if (item.habit.type !== "group") return <HabitRow {...props} />;
  const done = isDayHabitDone(item);
  return (
    <div
      id={`habit-${item.habit.id}`}
      className={`scroll-mt-16 space-y-3 rounded-xl border bg-court-900/40 p-4 ${done ? "border-neon/50" : "border-court-700"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {item.habit.name}
          {done && <span className="ml-2 text-sm text-neon">✓ done</span>}
        </p>
        <span className="text-sm tabular-nums text-court-300">{groupProgress(item)}</span>
      </div>
      <div className="space-y-2 border-l border-court-700 pl-3">
        {(item.children ?? []).map((c) => (
          <HabitRow key={c.habit.id} {...props} item={c} />
        ))}
      </div>
    </div>
  );
}

function HabitRow({
  item,
  day,
  names,
}: {
  item: DayHabitDto;
  day: DayDto;
  names: Map<string, string>;
}) {
  const save = useSaveEntry(day.date, item.habit.id);
  const { habit, entry } = item;
  const done = entry ? isHabitDone(habit.type, habit.config, entry) : false;
  const wide = habit.type === "journal" || habit.type === "shorttext" || habit.type === "slider";

  return (
    <div
      id={`habit-${habit.id}`}
      className={`scroll-mt-16 rounded-xl border bg-court-900/70 p-4 transition ${done ? "border-neon/50" : "border-court-700"}`}
    >
      <div className={`flex gap-3 ${wide ? "flex-col" : "flex-wrap items-center justify-between"}`}>
        <div className="min-w-0">
          <p className="font-medium">{habit.name}</p>
          {habit.links.length > 0 && (
            <p className="mt-0.5 flex flex-wrap gap-1.5">
              {habit.links.map((id) => (
                <NodeChip key={id} id={id} name={names.get(id)} />
              ))}
            </p>
          )}
        </div>
        <HabitEntryInput
          habit={habit}
          entry={entry}
          disabled={!day.editable}
          onSave={(value) => save.mutate(value)}
        />
      </div>
      {save.isError && (
        <div className="mt-2">
          <ErrorNote error={save.error} />
        </div>
      )}
    </div>
  );
}
