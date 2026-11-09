import {
  ALL_DAYS,
  MAX_CUSTOM_PROMPT_QUESTION,
  MAX_CUSTOM_PROMPTS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  type CustomPromptDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  useCreateCustomPrompt,
  useCustomPrompts,
  useDeleteCustomPrompt,
  useUpdateCustomPrompt,
} from "../../api/customPrompts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { scheduleLabel } from "../habits/ManageHabitsPage";

/** The player's own questions, asked in the day log on the days they pick (DESIGN.md §7.11). */
export function QuestionsPage() {
  const prompts = useCustomPrompts();
  const remove = useDeleteCustomPrompt();
  /** "new", a question id being edited, or null. */
  const [editing, setEditing] = useState<string | null>(null);

  if (prompts.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (prompts.isError) return <ErrorNote error={prompts.error} />;
  const full = prompts.data.length >= MAX_CUSTOM_PROMPTS;

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/log" className="text-sm text-court-300 hover:text-neon">
            ← Day log
          </Link>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Your questions</h1>
          <p className="mt-1 max-w-xl text-sm text-court-300">
            Questions you ask yourself on the days you pick, next to the scout's in the day log.
            Your answers go into that day's recap.
          </p>
        </div>
        {editing === null && !full && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            + New question
          </Button>
        )}
      </header>

      {editing === "new" && <QuestionEditor onDone={() => setEditing(null)} />}

      {prompts.data.length === 0 && editing === null && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          Something like "What's one thing you're grateful for?" every Sunday, or "What did you
          learn today?" on weekdays.
        </p>
      )}

      <ul className="space-y-3">
        {prompts.data.map((p) => (
          <li key={p.id}>
            {editing === p.id ? (
              <QuestionEditor prompt={p} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-court-700 bg-court-900/70 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.question}</p>
                  <p className="text-sm text-court-500">{scheduleLabel(p.days)}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    disabled={editing !== null}
                    onClick={() => setEditing(p.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    disabled={editing !== null || remove.isPending}
                    onClick={() => remove.mutate(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {full && (
        <p className="text-sm text-court-500">
          That's the most you can have ({MAX_CUSTOM_PROMPTS}).
        </p>
      )}
      <p className="text-sm text-court-500">
        Deleting a question keeps the answers you already gave.
      </p>
      <ErrorNote error={remove.error} />
    </div>
  );
}

function QuestionEditor({ prompt, onDone }: { prompt?: CustomPromptDto; onDone: () => void }) {
  const [question, setQuestion] = useState(prompt?.question ?? "");
  const [days, setDays] = useState<number[]>(prompt?.days ?? ALL_DAYS);
  const create = useCreateCustomPrompt();
  const update = useUpdateCustomPrompt();
  const saving = create.isPending || update.isPending;

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = { question: question.trim(), days };
    if (prompt) update.mutate({ id: prompt.id, ...body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={prompt ? "Edit question" : "New question"}
      className="space-y-5 rounded-xl border border-neon/40 bg-court-900 p-5"
    >
      <label className="block space-y-1">
        <span className="block text-xs uppercase tracking-wider text-court-300">Question</span>
        <input
          value={question}
          maxLength={MAX_CUSTOM_PROMPT_QUESTION}
          required
          autoFocus
          placeholder="e.g. What's one thing you're grateful for?"
          onChange={(e) => setQuestion(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wider text-court-300">Asked on</legend>
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
      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!question.trim() || days.length === 0 || saving}
        >
          {saving ? "Saving…" : prompt ? "Save question" : "Add question"}
        </Button>
      </div>
    </form>
  );
}
