import type { AnswerValue, OnboardingStateDto, QuestionDto } from "@rlo/shared";
import { useTalk } from "../../lib/talk";

function formatAnswer(question: QuestionDto, value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None of these";
  if (typeof value === "number") return `${value}${question.unit ? ` ${question.unit}` : ""}`;
  return value;
}

/** Read-only view of submitted answers and the follow-up chat. */
export function ScoutingRecap({ state }: { state: OnboardingStateDto }) {
  const talk = useTalk();
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wider">Your answers</h2>
        <dl className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
          {(state.questionnaire ?? []).map((q) => (
            <div key={q.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_14rem] sm:gap-6">
              <dt className="text-sm text-court-300">{q.prompt}</dt>
              <dd className="font-medium sm:text-right">{formatAnswer(q, state.answers[q.id])}</dd>
            </div>
          ))}
        </dl>
      </section>
      {state.chat.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl uppercase tracking-wider">Follow-up</h2>
          <div className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4 text-sm">
            {state.chat.map((m, i) => (
              <p key={i} className={m.role === "user" ? "text-court-100" : "text-court-300"}>
                <span className="mr-2 text-xs uppercase tracking-wider text-court-500">
                  {m.role === "user" ? "You" : talk.Scout}
                </span>
                {m.content}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
