import type { DayDto } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCoach, useSendCoachMessage, useStartPostgame } from "../../api/coach";
import { useEndDay } from "../../api/days";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";
import { Bubble, CoachAvatar, Composer, Message, TypingBubble } from "./CoachPage";

/**
 * The postgame interview (DESIGN.md §5.9): right after "End my day" the coach pops up with a
 * line on the day and questions about what the log is missing. What it logs from the answers
 * makes the recap stale, so updating it is one tap away.
 */
export function PostgameModal({
  day,
  open,
  onClose,
}: {
  day: DayDto;
  open: boolean;
  onClose: () => void;
}) {
  const talk = useTalk();
  return (
    <Modal open={open} onClose={onClose} label={`Postgame with the ${talk.coach}`} size="lg">
      <Postgame day={day} onClose={onClose} />
    </Modal>
  );
}

function Postgame({ day, onClose }: { day: DayDto; onClose: () => void }) {
  const talk = useTalk();
  const coach = useCoach();
  const start = useStartPostgame();
  const send = useSendCoachMessage();
  const endDay = useEndDay(day.date);
  const [draft, setDraft] = useState("");
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Mounted only while open, so this asks once per opening.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start.mutate(day.date);
  });

  // Only this interview: the opener and everything after it.
  const opener = start.data?.messages.at(-1);
  const messages = opener
    ? (coach.data?.messages ?? []).filter((m) => m.createdAt >= opener.createdAt)
    : [];
  const remaining = coach.data?.remaining ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, send.isPending, start.isPending]);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    setDraft("");
    send.mutate(message, { onError: () => setDraft((current) => current || message) });
  };

  return (
    <div className="flex max-h-[min(80dvh,44rem)] flex-col gap-4">
      <header className="flex items-center justify-between gap-3 border-b border-court-800 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <CoachAvatar size="lg" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold uppercase leading-none">Postgame</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-neon">
              {talk.coach} · {day.date === day.today ? "Today" : day.date}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </header>

      <div
        className="-mx-1 flex min-h-40 flex-1 flex-col gap-4 overflow-y-auto px-1"
        aria-live="polite"
      >
        {start.isPending && <TypingBubble />}
        <ErrorNote error={start.error} />
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {send.isPending && (
          <>
            <Bubble role="user" pending>
              {send.variables}
            </Bubble>
            <TypingBubble />
          </>
        )}
        <div ref={bottom} />
      </div>

      {day.status === "stale" && day.editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tier-yellow/50 bg-tier-yellow/5 p-3">
          <p className="text-sm text-court-100">
            You've logged more since the recap. Update it to score it.
          </p>
          <Button variant="primary" disabled={endDay.isPending} onClick={() => endDay.mutate()}>
            {endDay.isPending ? "Updating…" : "Update recap"}
          </Button>
          <ErrorNote error={endDay.error} />
        </div>
      )}
      <ErrorNote error={send.error} />
      {start.isSuccess && (
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => submit(draft)}
          busy={send.isPending}
          remaining={remaining}
          placeholder="Answer, or tell it what else you did…"
        />
      )}
      <p className="text-center text-xs text-court-500">
        The conversation carries on in{" "}
        <Link to="/coach" className="text-neon hover:underline" onClick={onClose}>
          the {talk.coach.toLowerCase()} chat
        </Link>
        .
      </p>
    </div>
  );
}
