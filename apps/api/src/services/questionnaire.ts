import { MAX_QUESTIONS, questionnaireOutputSchema, type QuestionDto } from "@rlo/shared";
import type { z } from "zod";

type RawQuestion = z.infer<typeof questionnaireOutputSchema>["questions"][number];

const DEFAULT_SLIDER = { min: 0, max: 10 };

/** Multi-choice questions get a built-in "None of these" button, so drop model-written ones. */
const NONE_OPTION = /^(none|none of (these|the above)|n\/a|not applicable)\.?$/i;

/** Aim for ~2 questions per rated attribute, within sane bounds. */
export function targetQuestionCount(leafCount: number): number {
  return Math.min(MAX_QUESTIONS, Math.max(6, leafCount * 2));
}

/** The output schema plus a coverage check, so the LLM client retries incomplete questionnaires. */
export function questionnaireSchemaFor(leafRefs: string[]) {
  return questionnaireOutputSchema.superRefine((output, ctx) => {
    const covered = new Set(output.questions.flatMap((q) => q.refs.map((r) => r.trim())));
    const missing = leafRefs.filter((ref) => !covered.has(ref));
    if (missing.length) {
      ctx.addIssue({ code: "custom", message: `No question covers: ${missing.join(", ")}` });
    }
  });
}

const finite = (n: number | null): number | null => (n !== null && Number.isFinite(n) ? n : null);

function normalizeOne(raw: RawQuestion, nodeIds: string[], id: string): QuestionDto | null {
  const prompt = raw.prompt.trim();
  if (!prompt || !nodeIds.length) return null;
  const base = { id, nodeIds, type: raw.type, prompt, options: [] as string[] };
  const empty = { min: null, max: null, minLabel: null, maxLabel: null, unit: null };

  switch (raw.type) {
    case "single_choice":
    case "multi_choice": {
      const options = [...new Set(raw.options.map((o) => o.trim()).filter(Boolean))]
        .filter((o) => raw.type === "single_choice" || !NONE_OPTION.test(o))
        .slice(0, 8);
      return options.length >= 2 ? { ...base, ...empty, options } : null;
    }
    case "slider": {
      let min = finite(raw.min);
      let max = finite(raw.max);
      if (min === null || max === null || min >= max) ({ min, max } = DEFAULT_SLIDER);
      return {
        ...base,
        ...empty,
        min,
        max,
        minLabel: raw.minLabel?.trim() || null,
        maxLabel: raw.maxLabel?.trim() || null,
      };
    }
    case "number": {
      const min = finite(raw.min);
      const max = finite(raw.max);
      const bounded = min !== null && max !== null && min >= max;
      return {
        ...base,
        ...empty,
        min: bounded ? null : min,
        max: bounded ? null : max,
        unit: raw.unit?.trim() || null,
      };
    }
    case "short_text":
      return { ...base, ...empty };
  }
}

/** Maps refs back to leaf ids, repairs or drops malformed questions, and assigns stable ids. */
export function normalizeQuestions(
  raw: RawQuestion[],
  idByRef: Map<string, string>,
  leafIds: Set<string>,
): QuestionDto[] {
  const questions: QuestionDto[] = [];
  for (const q of raw) {
    const nodeIds = [
      ...new Set(q.refs.map((r) => idByRef.get(r.trim())).filter((id) => id && leafIds.has(id))),
    ] as string[];
    const normalized = normalizeOne(q, nodeIds, `q${questions.length + 1}`);
    if (normalized) questions.push(normalized);
    if (questions.length === MAX_QUESTIONS) break;
  }
  return questions;
}
