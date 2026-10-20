import { MAX_CHAT_MESSAGE, type OnboardingStateDto } from "@rlo/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFinishFollowup, useFollowup } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";

export function FollowupChat({ state }: { state: OnboardingStateDto }) {
  const followup = useFollowup();
  const finish = useFinishFollowup();
  const [draft, setDraft] = useState("");
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const { chat } = state;

  // Open the conversation once (StrictMode mounts effects twice in dev).
  useEffect(() => {
    if (chat.length === 0 && !opened.current) {
      opened.current = true;
      followup.mutate(undefined);
    }
  }, [chat.length, followup]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [chat.length, followup.isPending]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || followup.isPending) return;
    // Clear right away so the reply reads as sent; restore it if sending fails.
    setDraft("");
    followup.mutate(message, { onError: () => setDraft((current) => current || message) });
  };
  const waiting = followup.isPending;

  return (
    <div className="space-y-6">
      <p className="text-court-300">
        A few quick follow-ups on your answers. Short replies are fine, or skip ahead any time.
      </p>
      <div className="space-y-3" aria-live="polite">
        {chat.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${
                m.role === "user"
                  ? "rounded-br-sm bg-neon/15 text-court-100"
                  : "rounded-bl-sm border border-court-700 bg-court-900"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {waiting && (
          <>
            {followup.variables && (
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-neon/10 px-4 py-2.5 text-court-300">
                  {followup.variables}
                </p>
              </div>
            )}
            <p className="w-fit animate-pulse rounded-2xl rounded-bl-sm border border-court-700 bg-court-900 px-4 py-2.5 text-court-500">
              …
            </p>
          </>
        )}
        <div ref={bottom} />
      </div>

      {followup.isError && (
        <div className="flex flex-wrap items-center gap-3">
          <ErrorNote error={followup.error} />
          {/* A failed reply is back in the input; only the opening turn needs a retry button. */}
          {chat.length === 0 && (
            <Button onClick={() => followup.mutate(undefined)}>Try again</Button>
          )}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          aria-label="Your reply"
          value={draft}
          maxLength={MAX_CHAT_MESSAGE}
          disabled={chat.length === 0}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your answer…"
          className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-2 outline-none focus:border-neon"
        />
        <Button type="submit" variant="primary" disabled={!draft.trim() || waiting}>
          Send
        </Button>
      </form>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          disabled={finish.isPending || waiting}
          onClick={() => finish.mutate()}
        >
          Skip to my ratings →
        </Button>
      </div>
      <ErrorNote error={finish.error} />
    </div>
  );
}
