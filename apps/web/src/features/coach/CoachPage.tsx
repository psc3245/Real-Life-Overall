import {
  COACH_STARTERS,
  HABIT_TYPE_LABELS,
  IMPORTANCE_LABELS,
  MAX_COACH_MESSAGE,
  WEEKDAY_SHORT,
  type CoachMessageDto,
  type CoachSuggestionDto,
} from "@rlo/shared";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
  useClearCoach,
  useCoach,
  useResolveCoachSuggestion,
  useSendCoachMessage,
} from "../../api/coach";
import { useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { ErrorNote } from "../onboarding/ErrorNote";
import { useTalk } from "../../lib/talk";

export function CoachPage() {
  const talk = useTalk();
  const coach = useCoach();
  const send = useSendCoachMessage();
  const clear = useClearCoach();
  const [draft, setDraft] = useState("");
  const [params, setParams] = useSearchParams();
  const asked = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const messages = coach.data?.messages ?? [];
  const remaining = coach.data?.remaining ?? 0;

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    // Clear right away so it reads as sent; restore it if sending fails.
    setDraft("");
    send.mutate(message, { onError: () => setDraft((current) => current || message) });
  };

  // A question asked from Today's coach card arrives as ?ask=… and is sent once.
  useEffect(() => {
    const ask = params.get("ask");
    if (!ask || asked.current || !coach.data) return;
    asked.current = true;
    setParams({}, { replace: true });
    submit(ask);
  });

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, send.isPending]);

  if (coach.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (coach.isError) return <ErrorNote error={coach.error} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">{talk.coachTagline}</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">{talk.coach}</h1>
          <p className="mt-1 max-w-xl text-court-300">
            Ask about your ratings, what to work on, or how to fit it into your week. The{" "}
            {talk.coach.toLowerCase()}
            knows your habits, goals, recent days and{" "}
            <Link to="/scouting-report" className="text-neon hover:underline">
              {talk.scoutingReport}
            </Link>
            , and can suggest habits and goals you add with one tap.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="danger"
            disabled={clear.isPending || send.isPending}
            onClick={() => {
              if (window.confirm("Clear the whole conversation?")) clear.mutate();
            }}
          >
            Clear chat
          </Button>
        )}
      </header>

      <div className="space-y-4" aria-live="polite">
        {messages.length === 0 && !send.isPending && (
          <div className="space-y-3 rounded-xl border border-dashed border-court-700 p-6 text-center">
            <p className="text-court-300">Not sure where to start? Try one of these.</p>
            <Starters onPick={submit} disabled={remaining === 0} />
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {send.isPending && (
          <>
            <Bubble role="user" pending>
              {send.variables}
            </Bubble>
            <p className="w-fit animate-pulse rounded-2xl rounded-bl-sm border border-court-700 bg-court-900 px-4 py-2.5 text-court-500">
              Thinking…
            </p>
          </>
        )}
        <div ref={bottom} />
      </div>

      <ErrorNote error={send.error ?? clear.error} />

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit(draft);
        }}
        className="sticky bottom-3 space-y-1 rounded-xl border border-court-700 bg-court-950/95 p-2 backdrop-blur"
      >
        <div className="flex gap-2">
          <textarea
            aria-label="Message the coach"
            value={draft}
            rows={1}
            maxLength={MAX_COACH_MESSAGE}
            disabled={remaining === 0}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder={remaining === 0 ? "Daily limit reached" : "Ask the coach…"}
            className="min-h-10 min-w-0 flex-1 resize-y rounded-lg bg-transparent px-3 py-2 outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!draft.trim() || send.isPending || remaining === 0}
          >
            Send
          </Button>
        </div>
        {remaining <= 5 && (
          <p className="px-3 text-xs text-court-500">
            {remaining} message{remaining === 1 ? "" : "s"} left in the last 24 hours.
          </p>
        )}
      </form>
      <DebugJson label="coach" data={coach.data} />
    </div>
  );
}

export function Starters({
  onPick,
  disabled = false,
}: {
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {COACH_STARTERS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-full border border-court-700 px-3 py-1.5 text-sm text-court-300 hover:border-neon hover:text-neon disabled:opacity-40"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Bubble({
  role,
  pending = false,
  children,
}: {
  role: CoachMessageDto["role"];
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={role === "user" ? "flex justify-end" : "flex"}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${
          role === "user"
            ? `rounded-br-sm ${pending ? "bg-neon/10 text-court-300" : "bg-neon/15 text-court-100"}`
            : "rounded-bl-sm border border-court-700 bg-court-900"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function Message({ message: m }: { message: CoachMessageDto }) {
  return (
    <div className="space-y-2">
      <Bubble role={m.role}>{m.content}</Bubble>
      {m.suggestions.length > 0 && (
        <ul className="space-y-2 sm:ml-6">
          {m.suggestions.map((s) => (
            <Suggestion key={s.index} messageId={m.id} suggestion={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

const KIND_LABEL: Record<CoachSuggestionDto["kind"], string> = {
  habit: "Habit",
  goal: "Goal",
  report: "Scouting Report",
};

const ADD_LABEL: Record<CoachSuggestionDto["kind"], string> = {
  habit: "Add habit",
  goal: "Add goal",
  report: "Add to report",
};

const SECTION_LABEL = {
  aspiration: "Aspiration",
  priority: "Priority",
  focus: "Focus",
  constraint: "Constraint",
} as const;

function describe(s: CoachSuggestionDto, names: Map<string, string>) {
  const nodes =
    s.kind !== "report" && s.nodeIds.length
      ? ` · ${s.nodeIds.map((id) => names.get(id) ?? "?").join(", ")}`
      : "";
  if (s.kind === "habit") {
    const schedule =
      s.days.length === 7 ? "every day" : s.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    const goal =
      s.target !== null
        ? ` · goal ${s.target} ${s.habitType === "duration" ? "min" : (s.unit ?? "")}`
        : "";
    return `${HABIT_TYPE_LABELS[s.habitType]} · ${schedule}${goal}${nodes}`;
  }
  if (s.kind === "goal") {
    return `${s.target} ${s.unit} in ${s.durationDays} day${s.durationDays === 1 ? "" : "s"}${nodes}`;
  }
  return `${SECTION_LABEL[s.section]}${
    s.importance ? ` · ${IMPORTANCE_LABELS[s.importance]}` : ""
  }${s.nodeId ? ` · ${names.get(s.nodeId) ?? "?"}` : ""}`;
}

function Suggestion({
  messageId,
  suggestion: s,
}: {
  messageId: string;
  suggestion: CoachSuggestionDto;
}) {
  const talk = useTalk();
  const resolve = useResolveCoachSuggestion();
  const ratings = useRatings();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  const title = s.kind === "report" ? s.text : s.name;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-court-700 bg-court-900/60 p-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-neon">
          {s.kind === "report" ? talk.scoutingReport : KIND_LABEL[s.kind]}
        </p>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-court-500">{describe(s, names)}</p>
        {s.reason && <p className="text-sm text-court-300">{s.reason}</p>}
        <ErrorNote error={resolve.error} />
      </div>
      {s.status === "pending" ? (
        <div className="flex gap-1">
          <Button
            variant="primary"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ messageId, index: s.index, action: "accept" })}
          >
            {ADD_LABEL[s.kind]}
          </Button>
          <Button
            variant="ghost"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ messageId, index: s.index, action: "dismiss" })}
          >
            No thanks
          </Button>
        </div>
      ) : (
        <span className="text-xs uppercase tracking-wider text-court-500">
          {s.status === "accepted" ? "✓ Added" : "Dismissed"}
        </span>
      )}
    </li>
  );
}
