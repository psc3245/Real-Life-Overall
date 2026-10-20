import {
  isRequired,
  unansweredRequired,
  validateAnswer,
  type AnswerValue,
  type Answers,
  type OnboardingStateDto,
  type QuestionDto,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { useSaveAnswers, useSubmitQuestionnaire } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";
import { QuestionField } from "./QuestionField";

const AUTOSAVE_DELAY_MS = 700;

/** Groups questions under the top-level category of the first attribute they inform. */
function groupByCategory(state: OnboardingStateDto, questions: QuestionDto[]) {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const categoryOf = (nodeId: string) => {
    let node = byId.get(nodeId);
    while (node && node.depth > 1) node = node.parentId ? byId.get(node.parentId) : undefined;
    return node;
  };
  const groups = new Map<string, { name: string; questions: QuestionDto[] }>();
  for (const q of questions) {
    const category = categoryOf(q.nodeIds[0]!);
    const key = category?.id ?? "other";
    if (!groups.has(key)) groups.set(key, { name: category?.name ?? "Other", questions: [] });
    groups.get(key)!.questions.push(q);
  }
  return [...groups.values()];
}

export function QuestionnaireForm({ state }: { state: OnboardingStateDto }) {
  const questions = state.questionnaire!;
  const [answers, setAnswers] = useState<Answers>(state.answers);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const pending = useRef<Record<string, AnswerValue | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = useSaveAnswers();
  const submit = useSubmitQuestionnaire();
  const [dirty, setDirty] = useState(false);

  const flush = async () => {
    clearTimeout(timer.current);
    const batch = pending.current;
    if (!Object.keys(batch).length) return;
    pending.current = {};
    try {
      await save.mutateAsync(batch);
      if (!Object.keys(pending.current).length) setDirty(false);
    } catch (error) {
      pending.current = { ...batch, ...pending.current }; // retry with the next change
      throw error;
    }
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (question: QuestionDto, value: AnswerValue | null) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === null) delete next[question.id];
      else next[question.id] = value;
      return next;
    });
    const problem = value === null ? null : validateAnswer(question, value);
    setInvalid((prev) => {
      const next = { ...prev };
      if (problem) next[question.id] = problem;
      else delete next[question.id];
      return next;
    });
    if (problem) return; // never autosave an invalid value
    pending.current[question.id] = value;
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush().catch(() => {}), AUTOSAVE_DELAY_MS);
  };

  const required = questions.filter(isRequired);
  const remaining = unansweredRequired(questions, answers).length;
  const answered = required.length - remaining;
  const canSubmit = remaining === 0 && Object.keys(invalid).length === 0;

  const onSubmit = async () => {
    try {
      await flush();
      submit.mutate();
    } catch {
      // The save error is shown below.
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-baseline justify-between text-sm text-court-300">
          <span>
            <span className="font-display text-2xl text-court-100 tabular-nums">{answered}</span> /{" "}
            {required.length} answered
          </span>
          <span aria-live="polite" className="text-xs uppercase tracking-wider text-court-500">
            {save.isError ? "Not saved" : dirty || save.isPending ? "Saving…" : "Saved"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-court-700">
          <div
            className="h-full rounded-full bg-neon transition-[width] duration-500"
            style={{ width: `${(answered / Math.max(1, required.length)) * 100}%` }}
          />
        </div>
      </div>

      {groupByCategory(state, questions).map((group) => (
        <section key={group.name} className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wider text-neon">{group.name}</h2>
          {group.questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-court-700 bg-court-900/70 p-5">
              <QuestionField
                question={q}
                value={answers[q.id]}
                onChange={(value) => onChange(q, value)}
              />
              {invalid[q.id] && <p className="mt-2 text-sm text-flare">{invalid[q.id]}</p>}
            </div>
          ))}
        </section>
      ))}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-court-800 bg-court-950/90 px-4 py-4 backdrop-blur">
        <div className="mr-auto min-w-0 text-sm text-court-300">
          {save.isError || submit.isError ? (
            <ErrorNote error={submit.error ?? save.error} />
          ) : remaining > 0 ? (
            `${remaining} left to answer`
          ) : (
            "All set. Text answers are optional."
          )}
        </div>
        <Button variant="primary" disabled={!canSubmit || submit.isPending} onClick={onSubmit}>
          {submit.isPending ? "Submitting…" : "Submit answers"}
        </Button>
      </div>
    </div>
  );
}
