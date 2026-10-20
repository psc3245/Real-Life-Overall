import { MAX_PROMPT_ANSWER, type DayDto } from "@rlo/shared";
import { useState } from "react";
import { useSavePromptAnswers } from "../../api/days";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Questions the previous day's recap asked; answers save when a field loses focus. */
export function GuidedPrompts({ day }: { day: DayDto }) {
  const save = useSavePromptAnswers(day.date);
  const [answers, setAnswers] = useState(day.prompts.map((p) => p.answer ?? ""));
  if (day.prompts.length === 0) return null;

  const commit = (i: number) => {
    if ((day.prompts[i]?.answer ?? "") === answers[i]) return;
    save.mutate(answers.map((a) => a || null));
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl uppercase tracking-wider">Scout's questions</h2>
      {day.prompts.map((p, i) => (
        <label key={p.question} className="block space-y-1.5">
          <span className="text-sm text-court-100">{p.question}</span>
          <input
            value={answers[i] ?? ""}
            maxLength={MAX_PROMPT_ANSWER}
            disabled={!day.editable}
            placeholder="One line is plenty"
            onChange={(e) =>
              setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
            }
            onBlur={() => commit(i)}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="w-full rounded-lg border border-court-700 bg-court-900/70 px-3 py-2 text-sm outline-none focus:border-neon"
          />
        </label>
      ))}
      <ErrorNote error={save.error} />
    </section>
  );
}
