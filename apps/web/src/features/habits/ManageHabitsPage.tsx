import { GROUP_RULE_LABELS, HABIT_TYPE_LABELS, type HabitDto } from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useArchiveHabit, useDay, useHabits } from "../../api/days";
import { useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { HabitEditor } from "./HabitEditor";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function scheduleLabel(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "0,6") return "Weekends";
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

export function ManageHabitsPage() {
  const habits = useHabits();
  const ratings = useRatings();
  const archive = useArchiveHabit();
  const today = useDay(null).data?.today;
  /** Habit id awaiting archive confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null);
  /** "new", a habit id being edited, "sub:<group id>" for a new sub-habit, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const nodes = ratings.data?.nodes ?? [];
  const names = new Map(nodes.map((n) => [n.id, n.name]));

  if (habits.isPending || ratings.isPending || !today)
    return <p className="pt-10 text-court-500">Loading…</p>;
  if (habits.isError) return <ErrorNote error={habits.error} />;

  const row = (h: HabitDto) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-court-700 bg-court-900/70 p-4">
      <div className="min-w-0">
        <p className="font-medium">{h.name}</p>
        <p className="text-sm text-court-500">
          {HABIT_TYPE_LABELS[h.type]}
          {h.type === "group" &&
            ` · ${GROUP_RULE_LABELS[h.config.rule ?? "all"]}${h.config.rule === "count" ? ` (${h.config.target})` : ""}`}
          {!h.parentId && ` · ${scheduleLabel(h.days)} · since ${h.startsOn}`}
          {h.links.length > 0 && ` · ${h.links.map((id) => names.get(id) ?? "?").join(", ")}`}
        </p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" disabled={editing !== null} onClick={() => setEditing(h.id)}>
          Edit
        </Button>
        {confirming === h.id ? (
          <span className="flex items-center gap-1 text-sm text-court-300">
            {h.type === "group"
              ? "Archive the group and its sub-habits?"
              : "Archive? History is kept."}
            <Button
              variant="danger"
              disabled={archive.isPending}
              onClick={() => archive.mutate(h.id, { onSettled: () => setConfirming(null) })}
            >
              {archive.isPending ? "Archiving…" : "Yes, archive"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="danger" disabled={editing !== null} onClick={() => setConfirming(h.id)}>
            Archive
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/habits" className="text-sm text-court-300 hover:text-neon">
            ← Habits at a glance
          </Link>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Manage habits</h1>
        </div>
        {editing === null && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            + New habit
          </Button>
        )}
      </header>

      {editing === "new" && (
        <HabitEditor nodes={nodes} today={today} onDone={() => setEditing(null)} />
      )}

      {habits.data.length === 0 && editing === null && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          Habits are the structured half of your day log. Link each one to the attributes it builds
          so recaps know what your effort means.
        </p>
      )}

      <ul className="space-y-3">
        {habits.data
          .filter((h) => !h.parentId)
          .map((h: HabitDto) => {
            const subs = habits.data.filter((c) => c.parentId === h.id);
            return (
              <li key={h.id} className="space-y-2">
                {editing === h.id ? (
                  <HabitEditor
                    habit={h}
                    nodes={nodes}
                    today={today}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  row(h)
                )}
                {h.type === "group" && (
                  <ul className="ml-4 space-y-2 border-l border-court-700 pl-4">
                    {subs.map((c) => (
                      <li key={c.id}>
                        {editing === c.id ? (
                          <HabitEditor
                            habit={c}
                            parent={h}
                            nodes={nodes}
                            today={today}
                            onDone={() => setEditing(null)}
                          />
                        ) : (
                          row(c)
                        )}
                      </li>
                    ))}
                    <li>
                      {editing === `sub:${h.id}` ? (
                        <HabitEditor
                          parent={h}
                          nodes={nodes}
                          today={today}
                          onDone={() => setEditing(null)}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          disabled={editing !== null}
                          onClick={() => setEditing(`sub:${h.id}`)}
                        >
                          + Sub-habit
                        </Button>
                      )}
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
      </ul>
      <ErrorNote error={archive.error} />
    </div>
  );
}
