import { MAX_SHORT_TEXT_ANSWER, type AnswerValue, type QuestionDto } from "@rlo/shared";

interface FieldProps {
  question: QuestionDto;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | null) => void;
}

const pill = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition ${
    selected
      ? "border-neon bg-neon/15 text-neon"
      : "border-court-700 text-court-300 hover:border-court-500 hover:text-court-100"
  }`;

export function QuestionField({ question, value, onChange }: FieldProps) {
  const labelId = `${question.id}-label`;
  return (
    <fieldset className="space-y-3" aria-labelledby={labelId}>
      <legend id={labelId} className="text-base font-medium text-court-100">
        {question.prompt}
        {question.type === "short_text" && (
          <span className="ml-2 text-xs uppercase tracking-wider text-court-500">optional</span>
        )}
      </legend>
      <Input question={question} value={value} onChange={onChange} />
    </fieldset>
  );
}

function Input({ question, value, onChange }: FieldProps) {
  switch (question.type) {
    case "single_choice":
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              className={pill(value === option)}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      );

    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (option: string) =>
        onChange(
          selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option],
        );
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                role="checkbox"
                aria-checked={selected.includes(option)}
                className={pill(selected.includes(option))}
                onClick={() => toggle(option)}
              >
                {option}
              </button>
            ))}
          </div>
          {value === undefined && (
            <button
              type="button"
              className="text-xs uppercase tracking-wider text-court-500 hover:text-neon"
              onClick={() => onChange([])}
            >
              None of these
            </button>
          )}
        </div>
      );
    }

    case "slider": {
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const set = typeof value === "number";
      const current = set ? value : (min + max) / 2;
      return (
        <div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={current}
              aria-labelledby={`${question.id}-label`}
              onChange={(e) => onChange(Number(e.target.value))}
              // A click on the untouched midpoint fires no change event, so record it here.
              onPointerUp={(e) => !set && onChange(Number(e.currentTarget.value))}
              className={`w-full accent-[var(--color-neon)] ${set ? "" : "opacity-40"}`}
            />
            <span className="w-10 text-right font-display text-xl tabular-nums text-neon">
              {set ? value : "–"}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-court-500">
            <span>{question.minLabel ?? min}</span>
            <span>{question.maxLabel ?? max}</span>
          </div>
        </div>
      );
    }

    case "number":
      return (
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="decimal"
            min={question.min ?? undefined}
            max={question.max ?? undefined}
            value={typeof value === "number" ? value : ""}
            aria-labelledby={`${question.id}-label`}
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              onChange(Number.isFinite(n) ? n : null);
            }}
            className="w-32 rounded-lg border border-court-700 bg-court-950 px-3 py-2 tabular-nums outline-none focus:border-neon"
          />
          {question.unit && <span className="text-sm text-court-300">{question.unit}</span>}
        </div>
      );

    case "short_text":
      return (
        <textarea
          rows={2}
          maxLength={MAX_SHORT_TEXT_ANSWER}
          value={typeof value === "string" ? value : ""}
          aria-labelledby={`${question.id}-label`}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="w-full rounded-lg border border-court-700 bg-court-950 p-3 text-sm outline-none focus:border-neon"
        />
      );
  }
}
