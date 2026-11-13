import {
  COMPARE_SYMBOLS,
  describeHabitGoal,
  habitCompare,
  isHabitDone,
  MAX_HABIT_JOURNAL,
  MAX_HABIT_NOTE,
  MAX_HABIT_SHORT_TEXT,
  type HabitDto,
  parseTimeOfDay,
  timeInputValue,
  type HabitEntryValue,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";

interface Props {
  habit: HabitDto;
  entry: HabitEntryValue | null;
  disabled: boolean;
  onSave: (value: HabitEntryValue) => void;
}

const DEBOUNCE_MS = 500;

/** Debounces rapid changes (counter taps, slider drags) into one save. */
function useDebouncedSave(onSave: Props["onSave"]) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (value: HabitEntryValue) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(value), DEBOUNCE_MS);
  };
}

const stepButton =
  "h-9 w-9 rounded-lg border border-court-700 text-lg text-court-100 hover:border-neon disabled:opacity-40";

/** The control for logging one habit, by type. Holds local state so typing stays responsive. */
export function HabitEntryInput({ habit, entry, disabled, onSave }: Props) {
  const [num, setNum] = useState<number | null>(entry?.num ?? null);
  const [text, setText] = useState(entry?.text ?? "");
  const debounced = useDebouncedSave(onSave);
  const { config } = habit;

  const avoid = config.direction === "avoid";
  // Over a limit, or missing a stay-under goal: shown in the warning color.
  const compare = habitCompare(habit.type, config);
  const over =
    num !== null &&
    (avoid || compare === "atMost" || compare === "lessThan") &&
    !isHabitDone(habit.type, config, { num, text: null });

  switch (habit.type) {
    case "checkbox":
    case "checknote": {
      if (avoid) {
        const pick = (next: 0 | 1) => {
          const value = num === next ? null : next;
          setNum(value);
          onSave({ num: value, text: value === 1 ? text || null : null });
        };
        const choice = (value: 0 | 1, label: string, on: string) => (
          <button
            type="button"
            aria-pressed={num === value}
            disabled={disabled}
            onClick={() => pick(value)}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition ${num === value ? on : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {label}
          </button>
        );
        return (
          <div
            className={`flex flex-wrap items-center gap-2 ${habit.type === "checknote" && num === 1 ? "w-full" : ""}`}
          >
            {choice(0, "✓ Avoided", "border-neon bg-neon/15 text-neon")}
            {choice(1, "✗ Slipped", "border-flare bg-flare/15 text-flare")}
            {habit.type === "checknote" && num === 1 && (
              <input
                aria-label={`${habit.name} note`}
                value={text}
                maxLength={MAX_HABIT_NOTE}
                disabled={disabled}
                placeholder="What happened?"
                onChange={(e) => setText(e.target.value)}
                onBlur={() =>
                  text !== (entry?.text ?? "") && onSave({ num: 1, text: text || null })
                }
                className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-1.5 text-sm outline-none focus:border-neon"
              />
            )}
          </div>
        );
      }
      const done = num === 1;
      return (
        <div
          className={`flex flex-wrap items-center gap-3 ${habit.type === "checknote" && done ? "w-full" : ""}`}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${habit.name} done`}
            disabled={disabled}
            onClick={() => {
              const next = done ? null : 1;
              setNum(next);
              onSave({ num: next, text: next === null ? null : text || null });
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg font-bold transition ${
              done
                ? "border-neon bg-neon text-court-950"
                : "border-court-500 text-transparent hover:border-neon"
            }`}
          >
            ✓
          </button>
          {habit.type === "checknote" && done && (
            <input
              aria-label={`${habit.name} note`}
              value={text}
              maxLength={MAX_HABIT_NOTE}
              disabled={disabled}
              placeholder="Add a note"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text !== (entry?.text ?? "") && onSave({ num: 1, text: text || null })}
              className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-1.5 text-sm outline-none focus:border-neon"
            />
          )}
        </div>
      );
    }

    case "counter":
    case "duration": {
      const step = habit.type === "duration" ? 15 : 1;
      const unit = habit.type === "duration" ? "min" : config.unit;
      const set = (n: number) => {
        const next = Math.max(0, n);
        setNum(next);
        debounced({ num: next, text: null });
      };
      const value = num ?? 0;
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease"
            className={stepButton}
            disabled={disabled || value <= 0}
            onClick={() => set(value - step)}
          >
            −
          </button>
          <input
            aria-label={`${habit.name} amount`}
            type="number"
            inputMode="numeric"
            min={0}
            value={num ?? ""}
            disabled={disabled}
            placeholder="0"
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              if (Number.isFinite(n)) set(habit.type === "counter" ? Math.round(n) : n);
              else {
                setNum(null);
                debounced({ num: null, text: null });
              }
            }}
            className="w-16 rounded-lg border border-court-700 bg-court-950 px-2 py-1.5 text-center tabular-nums outline-none focus:border-neon"
          />
          <button
            type="button"
            aria-label="Increase"
            className={stepButton}
            disabled={disabled}
            onClick={() => set(value + step)}
          >
            +
          </button>
          <span className={`text-sm ${over ? "text-flare" : "text-court-300"}`}>
            {`/ ${avoid ? "≤" : COMPARE_SYMBOLS[compare]}${config.target}`} {unit}
          </span>
        </div>
      );
    }

    case "slider": {
      const min = config.min ?? 0;
      const max = config.max ?? 10;
      return (
        <div className="flex w-full items-center gap-3">
          <input
            type="range"
            aria-label={habit.name}
            min={min}
            max={max}
            value={num ?? (min + max) / 2}
            disabled={disabled}
            onChange={(e) => {
              setNum(Number(e.target.value));
              debounced({ num: Number(e.target.value), text: null });
            }}
            onPointerUp={(e) =>
              num === null && onSave({ num: Number(e.currentTarget.value), text: null })
            }
            className={`w-full accent-[var(--color-neon)] ${num === null ? "opacity-40" : ""}`}
          />
          <span
            className={`w-8 text-right font-display text-lg tabular-nums ${over ? "text-flare" : "text-neon"}`}
          >
            {num ?? "–"}
          </span>
        </div>
      );
    }

    case "time": {
      const goal = describeHabitGoal(habit.type, config);
      const missed = num !== null && !isHabitDone(habit.type, config, { num, text: null });
      const set = (next: number | null) => {
        setNum(next);
        debounced({ num: next, text: null });
      };
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            aria-label={`${habit.name} time`}
            value={num !== null ? timeInputValue(num) : ""}
            disabled={disabled}
            onChange={(e) => set(parseTimeOfDay(e.target.value))}
            className="rounded-lg border border-court-700 bg-court-950 px-2 py-1.5 tabular-nums outline-none focus:border-neon"
          />
          {num === null && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const now = new Date();
                set(now.getHours() * 60 + now.getMinutes());
              }}
              className="rounded-lg border border-court-700 px-2.5 py-1.5 text-sm text-court-300 hover:border-neon disabled:opacity-40"
            >
              Now
            </button>
          )}
          {goal && (
            <span className={`text-sm ${missed ? "text-flare" : "text-court-300"}`}>{goal}</span>
          )}
        </div>
      );
    }

    case "rating":
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={habit.name}>
          {Array.from({ length: config.max ?? 5 }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={num === star}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              disabled={disabled}
              onClick={() => {
                const next = num === star ? null : star;
                setNum(next);
                onSave({ num: next, text: null });
              }}
              className={`text-2xl transition ${num !== null && star <= num ? "text-tier-yellow" : "text-court-700 hover:text-court-500"}`}
            >
              ★
            </button>
          ))}
        </div>
      );

    case "shorttext":
    case "journal": {
      const max = habit.type === "journal" ? MAX_HABIT_JOURNAL : MAX_HABIT_SHORT_TEXT;
      const commit = () =>
        text !== (entry?.text ?? "") && onSave({ num: null, text: text || null });
      const shared = {
        "aria-label": habit.name,
        value: text,
        maxLength: max,
        disabled,
        placeholder: avoid
          ? "Only if you slipped: what happened?"
          : habit.type === "journal"
            ? "Write it down…"
            : "Answer…",
        onChange: (e: { target: { value: string } }) => setText(e.target.value),
        onBlur: commit,
        className:
          "w-full rounded-lg border border-court-700 bg-court-950 px-3 py-2 text-sm outline-none focus:border-neon",
      };
      return habit.type === "journal" ? <textarea rows={3} {...shared} /> : <input {...shared} />;
    }
  }
}
