import {
  COACH_STARTERS,
  HABIT_TYPE_LABELS,
  IMPORTANCE_LABELS,
  MAX_COACH_MESSAGE,
  WEEKDAY_SHORT,
  type CoachActionDto,
  type CoachMessageDto,
  type CoachThreadDto,
  type CoachSuggestionDto,
} from "@rlo/shared";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router";
import {
  useCoach,
  useCoachThreads,
  useDeleteCoachThread,
  useResolveCoachSuggestion,
  useSendCoachMessage,
  useUndoCoachAction,
} from "../../api/coach";
import { useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { ErrorNote } from "../onboarding/ErrorNote";
import { useTalk } from "../../lib/talk";
import { weekdayDate } from "../../lib/format";

export function CoachPage() {
  const talk = useTalk();
  const [params, setParams] = useSearchParams();
  // ?thread=<id>, ?thread=new for a fresh chat; nothing opens the latest.
  const ref = params.get("thread") ?? "latest";
  const coach = useCoach(ref);
  const threads = useCoachThreads();
  const send = useSendCoachMessage();
  const remove = useDeleteCoachThread();
  const [draft, setDraft] = useState("");
  const asked = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const thread = coach.data?.thread ?? null;
  const messages = coach.data?.messages ?? [];
  const remaining = coach.data?.remaining ?? 0;
  const empty = messages.length === 0 && !send.isPending;

  const open = (id: string | null) =>
    setParams(id ? { thread: id } : { thread: "new" }, { replace: false });

  const submit = (text: string, threadId = ref === "new" ? null : (thread?.id ?? null)) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    // Clear right away so it reads as sent; restore it if sending fails.
    setDraft("");
    send.mutate(
      { content: message, threadId },
      {
        onSuccess: (state) => {
          if (state.thread && state.thread.id !== thread?.id) {
            setParams({ thread: state.thread.id }, { replace: true });
          }
        },
        onError: () => setDraft((current) => current || message),
      },
    );
  };

  // A question asked from Today's coach card arrives as ?ask=… and starts its own chat, once.
  useEffect(() => {
    const ask = params.get("ask");
    if (!ask || asked.current || !coach.data) return;
    asked.current = true;
    setParams({ thread: "new" }, { replace: true });
    submit(ask, null);
  });

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, send.isPending]);

  if (coach.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (coach.isError) return <ErrorNote error={coach.error} />;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 pt-4 md:grid-cols-[15rem_minmax(0,1fr)]">
      <ThreadList
        threads={threads.data ?? []}
        active={ref === "new" ? null : (thread?.id ?? null)}
        onOpen={open}
      />
      <div className="flex min-h-[calc(100dvh-8rem)] min-w-0 flex-col gap-6">
        <header className="flex items-center justify-between gap-4 border-b border-court-800 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <CoachAvatar size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold uppercase leading-none">
                {talk.coach}
              </h1>
              <p className="mt-1 truncate text-xs uppercase tracking-[0.3em] text-neon">
                {thread && ref !== "new" ? thread.title : talk.coachTagline}
              </p>
            </div>
          </div>
          {thread && ref !== "new" && (
            <Button
              variant="ghost"
              disabled={remove.isPending || send.isPending}
              onClick={() => {
                if (!window.confirm("Delete this conversation?")) return;
                remove.mutate(thread.id, { onSuccess: () => setParams({}, { replace: true }) });
              }}
            >
              Delete chat
            </Button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-4" aria-live="polite">
          {(empty || ref === "new") && !send.isPending && (
            <div className="m-auto flex max-w-xl flex-col items-center gap-3 py-8 text-center">
              <CoachAvatar size="xl" />
              <h2 className="font-display text-3xl font-bold uppercase">What are we working on?</h2>
              <p className="text-court-300">
                The {talk.coach.toLowerCase()} knows your habits, goals, recent days and{" "}
                <Link to="/scouting-report" className="text-neon hover:underline">
                  {talk.scoutingReport}
                </Link>
                . Tell it what you did and it logs workouts, habits and goal progress; ask and it
                makes habits, goals and workout templates for you.
              </p>
              <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
                {COACH_STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={remaining === 0}
                    onClick={() => submit(s)}
                    className="rounded-xl border border-court-700 bg-court-900/60 px-4 py-3 text-left text-sm text-court-100 transition hover:border-neon hover:bg-court-900 disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ref !== "new" && messages.map((m) => <Message key={m.id} message={m} />)}
          {send.isPending && (
            <>
              <Bubble role="user" pending>
                {send.variables?.content}
              </Bubble>
              <TypingBubble />
            </>
          )}
          <div ref={bottom} />
        </div>

        <ErrorNote error={send.error ?? remove.error} />

        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => submit(draft)}
          busy={send.isPending}
          remaining={remaining}
          placeholder={`Ask the ${talk.coach.toLowerCase()}…`}
        />
        <DebugJson label="coach" data={coach.data} />
      </div>
    </div>
  );
}

/** Conversations, newest first: a sidebar on wide screens, a picker on phones. */
function ThreadList({
  threads,
  active,
  onOpen,
}: {
  threads: CoachThreadDto[];
  active: string | null;
  onOpen: (id: string | null) => void;
}) {
  return (
    <nav aria-label="Conversations" className="space-y-2 md:sticky md:top-20 md:self-start">
      <Button variant="primary" className="w-full" onClick={() => onOpen(null)}>
        + New chat
      </Button>
      {threads.length > 0 && (
        <>
          <select
            aria-label="Open a conversation"
            value={active ?? ""}
            onChange={(e) => onOpen(e.target.value || null)}
            className="w-full rounded-lg border border-court-700 bg-court-900 px-3 py-2 text-sm md:hidden"
          >
            {active === null && <option value="">New chat</option>}
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <ul className="hidden max-h-[calc(100dvh-12rem)] space-y-1 overflow-y-auto md:block">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-current={t.id === active ? "page" : undefined}
                  onClick={() => onOpen(t.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${t.id === active ? "bg-court-800 text-court-100" : "text-court-300 hover:bg-court-900 hover:text-court-100"}`}
                >
                  <span className="block truncate text-sm">{t.title}</span>
                  <span className="block text-[11px] text-court-500">
                    {new Date(t.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}

/** The message box: grows with its text, autocorrects, Enter sends and Shift+Enter breaks a line. */
export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  remaining,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  remaining: number;
  placeholder: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const out = remaining === 0;
  const canSend = !!value.trim() && !busy && !out;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="sticky bottom-3 space-y-1.5"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-court-700 bg-court-900/95 p-1.5 pl-4 shadow-lg shadow-black/40 backdrop-blur transition focus-within:border-neon/60">
        <textarea
          ref={box}
          aria-label="Message the coach"
          value={value}
          rows={1}
          maxLength={MAX_COACH_MESSAGE}
          disabled={out}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={out ? "Daily limit reached" : placeholder}
          className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent py-2 leading-6 outline-none placeholder:text-court-500"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon text-court-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path
              d="M12 19V5m0 0-6 6m6-6 6 6"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="flex justify-between gap-3 px-2 text-xs text-court-500">
        <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
        <span className="ml-auto">
          {remaining <= 5 &&
            `${remaining} message${remaining === 1 ? "" : "s"} left in the last 24 hours`}
          {remaining > 5 &&
            value.length > MAX_COACH_MESSAGE - 200 &&
            `${MAX_COACH_MESSAGE - value.length} characters left`}
        </span>
      </p>
    </form>
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

/** The coach's badge: an OVR-style monogram on a neon disc. */
export function CoachAvatar({ size = "sm" }: { size?: "sm" | "lg" | "xl" }) {
  const sizes = { sm: "size-8 text-xs", lg: "size-12 text-base", xl: "size-16 text-xl" };
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-neon font-display font-bold uppercase text-court-950 shadow-[0_0_24px_-4px] shadow-neon/60 ${sizes[size]}`}
    >
      HC
    </span>
  );
}

export function Bubble({
  role,
  pending = false,
  time,
  children,
}: {
  role: CoachMessageDto["role"];
  pending?: boolean;
  time?: string;
  children: ReactNode;
}) {
  const user = role === "user";
  return (
    <div className={`flex items-end gap-2 ${user ? "justify-end" : ""}`}>
      {!user && <CoachAvatar />}
      <p
        title={time ? new Date(time).toLocaleString() : undefined}
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 leading-relaxed ${
          user
            ? `rounded-br-md bg-neon font-medium text-court-950 ${pending ? "opacity-60" : ""}`
            : "rounded-bl-md border border-court-700 bg-court-900 text-court-100"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/** Three dots that bounce in turn while the coach writes a reply. */
export function TypingBubble() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="The coach is typing">
      <CoachAvatar />
      <span className="flex gap-1 rounded-2xl rounded-bl-md border border-court-700 bg-court-900 px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-court-300"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

export function Message({ message: m }: { message: CoachMessageDto }) {
  return (
    <div className="space-y-2">
      <Bubble role={m.role} time={m.createdAt}>
        {m.content}
      </Bubble>
      {m.actions.length > 0 && (
        <ul className="space-y-2 pl-10" aria-label="Logged by the coach">
          {m.actions.map((a) => (
            <Receipt key={a.index} messageId={m.id} action={a} />
          ))}
        </ul>
      )}
      {m.suggestions.length > 0 && (
        <ul className="space-y-2 pl-10">
          {m.suggestions.map((s) => (
            <Suggestion key={s.index} messageId={m.id} suggestion={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<CoachActionDto["kind"], string> = {
  workout: "Workout logged",
  habit: "Habit logged",
  goal: "Goal progress",
  newHabit: "Habit created",
  newGoal: "Goal created",
  template: "Template saved",
};

function receiptLink(a: CoachActionDto) {
  switch (a.kind) {
    case "workout":
      return `/workouts/${a.workoutId}`;
    case "template":
      return `/workouts/templates/${a.templateId}`;
    case "newHabit":
      return "/habits/manage";
    case "newGoal":
      return "/goals";
    default:
      return `/log?date=${a.date}#${a.kind}s`;
  }
}

/** Something the coach logged or made, with undo (it writes to the player's data directly). */
function Receipt({ messageId, action: a }: { messageId: string; action: CoachActionDto }) {
  const undo = useUndoCoachAction();
  const link = receiptLink(a);
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${a.undone ? "border-court-800 opacity-60" : "border-neon/40 bg-neon/5"}`}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-neon">
          {a.undone ? "Undone" : `✓ ${ACTION_LABEL[a.kind]}`} · {weekdayDate(a.date)}
        </p>
        <p className={`font-medium ${a.undone ? "line-through" : ""}`}>
          {a.undone ? (
            a.title
          ) : (
            <Link to={link} className="hover:text-neon">
              {a.title}
            </Link>
          )}
        </p>
        <p className="text-sm text-court-300">{a.detail}</p>
        <ErrorNote error={undo.error} />
      </div>
      {!a.undone && (
        <Button
          variant="ghost"
          disabled={undo.isPending}
          onClick={() => undo.mutate({ messageId, index: a.index })}
        >
          Undo
        </Button>
      )}
    </li>
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
