import type { Answers, QuestionDto } from "@rlo/shared";

/** Renders questionnaire answers for prompts, tagging each with the attributes it informs. */
export function renderAnswers(
  questions: QuestionDto[],
  answers: Answers,
  refById: Map<string, string>,
): string {
  return questions
    .map((q) => {
      const refs = q.nodeIds.map((id) => refById.get(id)).filter(Boolean);
      const value = answers[q.id];
      let answer: string;
      if (value === undefined || value === "") answer = "(skipped)";
      else if (Array.isArray(value)) answer = value.length ? value.join("; ") : "(none of these)";
      else if (typeof value === "number") answer = `${value}${q.unit ? ` ${q.unit}` : ""}`;
      else answer = value;
      const scale =
        q.type === "slider"
          ? ` (scale ${q.min}=${q.minLabel ?? "low"} to ${q.max}=${q.maxLabel ?? "high"})`
          : "";
      return `Q [${refs.join(", ")}]: ${q.prompt}${scale}\nA: ${answer}`;
    })
    .join("\n\n");
}
