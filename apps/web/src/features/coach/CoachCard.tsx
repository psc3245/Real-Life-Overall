import { MAX_COACH_MESSAGE } from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Starters } from "./CoachPage";
import { useTalk } from "../../lib/talk";

/** Today's way into the coach: a question box and starter questions. */
export function CoachCard() {
  const talk = useTalk();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const ask = (text: string) => {
    if (text.trim()) navigate(`/coach?ask=${encodeURIComponent(text.trim())}`);
  };
  return (
    <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-wider">
          Ask the {talk.coach.toLowerCase()}
        </h2>
        <Link to="/coach" className="text-sm text-court-300 hover:text-neon">
          Open chat →
        </Link>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          aria-label={`Ask the ${talk.coach.toLowerCase()}`}
          value={draft}
          maxLength={MAX_COACH_MESSAGE}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What should I work on today?"
          className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-2 text-sm outline-none focus:border-neon"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-neon px-3 py-2 font-display text-sm font-semibold uppercase tracking-wider text-court-950 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
      <Starters onPick={ask} />
    </section>
  );
}
