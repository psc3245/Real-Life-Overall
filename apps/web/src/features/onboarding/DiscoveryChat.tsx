import { MAX_CHAT_MESSAGE, MIN_DISCOVERY_ANSWERS, type OnboardingStateDto } from "@rlo/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDiscovery, useDraftTemplate, useSkipDiscovery } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";

const DRAFTING = [
  "Reading your conversation…",
  "Choosing your categories…",
  "Weighing what matters…",
];

/** Step 1: get to know the player, then let the scout draft their rating tree. */
export function DiscoveryChat({ state }: { state: OnboardingStateDto }) {
  const chat = useDiscovery();
  const draft = useDraftTemplate();
  const skip = useSkipDiscovery();
  const [text, setText] = useState("");
  const [line, setLine] = useState(0);
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const { messages, done } = state.discovery;
  const answers = messages.filter((m) => m.role === "user").length;
  const busy = chat.isPending || draft.isPending || skip.isPending;

  // Open the conversation once (StrictMode mounts effects twice in dev).
  useEffect(() => {
    if (messages.length === 0 && !opened.current) {
      opened.current = true;
      chat.mutate(undefined);
    }
  }, [messages.length, chat]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, chat.isPending]);

  useEffect(() => {
    if (!draft.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % DRAFTING.length), 3500);
    return () => clearInterval(timer);
  }, [draft.isPending]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    chat.mutate(message, { onError: () => setText((current) => current || message) });
  };

  return (
    <div className="space-y-6">
      <p className="text-court-300">
        First, a short conversation so the scout understands what matters in your life. Then it
        drafts your rating tree for you to edit.
      </p>
      <div className="space-y-3" aria-live="polite">
        {messages.map((m, i) => (
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
        {chat.isPending && (
          <>
            {chat.variables && (
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-neon/10 px-4 py-2.5 text-court-300">
                  {chat.variables}
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

      {chat.isError && (
        <div className="flex flex-wrap items-center gap-3">
          <ErrorNote error={chat.error} />
          {messages.length === 0 && (
            <Button onClick={() => chat.mutate(undefined)}>Try again</Button>
          )}
        </div>
      )}

      {!done && (
        <form onSubmit={send} className="flex gap-2">
          <input
            aria-label="Your reply"
            value={text}
            maxLength={MAX_CHAT_MESSAGE}
            disabled={messages.length === 0 || draft.isPending}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-2 outline-none focus:border-neon"
          />
          <Button type="submit" variant="primary" disabled={!text.trim() || busy}>
            Send
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-court-800 pt-4">
        <Button variant="ghost" disabled={busy} onClick={() => skip.mutate()}>
          Skip, I'll build it myself
        </Button>
        <div className="flex items-center gap-3">
          {answers < MIN_DISCOVERY_ANSWERS && (
            <span className="text-sm text-court-500">
              Answer {MIN_DISCOVERY_ANSWERS - answers} more to draft your tree.
            </span>
          )}
          <Button
            variant={done ? "primary" : "secondary"}
            className={done ? "px-6 py-3 text-base" : ""}
            disabled={answers < MIN_DISCOVERY_ANSWERS || busy}
            onClick={() => draft.mutate()}
          >
            {draft.isPending ? DRAFTING[line] : "Build my template"}
          </Button>
        </div>
      </div>
      {draft.isPending && (
        <p className="text-right text-sm text-court-500">This can take up to a minute.</p>
      )}
      <ErrorNote error={draft.error ?? skip.error} />
    </div>
  );
}
