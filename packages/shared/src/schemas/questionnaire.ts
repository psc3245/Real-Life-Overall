import { z } from "zod";

export const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "slider",
  "number",
  "short_text",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MAX_QUESTIONS = 40;
export const MAX_SHORT_TEXT_ANSWER = 500;
export const MAX_FOLLOWUP_TURNS = 5;
export const MAX_CHAT_MESSAGE = 1000;

/** A normalized scouting question. Every question informs one or more leaf nodes. */
export interface QuestionDto {
  id: string;
  nodeIds: string[];
  type: QuestionType;
  prompt: string;
  /** Choice questions only, ordered from least to most. */
  options: string[];
  /** Slider (required) and number (optional) bounds. */
  min: number | null;
  max: number | null;
  minLabel: string | null;
  maxLabel: string | null;
  unit: string | null;
}

export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

/** Short-text questions are optional; everything else needs an answer before submitting. */
export function isRequired(question: QuestionDto): boolean {
  return question.type !== "short_text";
}

/** Returns an error message, or null when `value` is a valid answer to `question`. */
export function validateAnswer(question: QuestionDto, value: unknown): string | null {
  switch (question.type) {
    case "single_choice":
      return typeof value === "string" && question.options.includes(value)
        ? null
        : "Pick one of the options";
    case "multi_choice":
      return Array.isArray(value) &&
        value.every((v) => typeof v === "string" && question.options.includes(v)) &&
        new Set(value).size === value.length
        ? null
        : "Pick from the options";
    case "slider":
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number";
      if (question.min !== null && value < question.min) return `Must be at least ${question.min}`;
      if (question.max !== null && value > question.max) return `Must be at most ${question.max}`;
      return null;
    }
    case "short_text":
      return typeof value === "string" && value.length <= MAX_SHORT_TEXT_ANSWER
        ? null
        : `Keep it under ${MAX_SHORT_TEXT_ANSWER} characters`;
  }
}

export function unansweredRequired(questions: QuestionDto[], answers: Answers): QuestionDto[] {
  return questions.filter((q) => isRequired(q) && answers[q.id] === undefined);
}

export interface ChatMessageDto {
  role: "assistant" | "user";
  content: string;
}

// Request bodies

const answerValueSchema = z.union([
  z.string().max(MAX_SHORT_TEXT_ANSWER),
  z.array(z.string().max(200)).max(20),
  z.number(),
]);

/** Partial saves merge into stored answers; `null` clears an answer. */
export const saveAnswersBodySchema = z.object({
  answers: z.record(z.string().max(16), answerValueSchema.nullable()),
});

export const followupMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE),
});

// LLM outputs (flat and nullable for strict structured-output modes)

export const questionnaireOutputSchema = z.object({
  questions: z.array(
    z.object({
      refs: z
        .array(z.string())
        .describe('Refs of the attributes this question informs, e.g. ["n3"]'),
      type: z.enum(QUESTION_TYPES),
      prompt: z.string().describe("The question, one sentence, concrete and behavior-anchored"),
      options: z
        .array(z.string())
        .describe("Choice questions: 3-6 options ordered low to high. Otherwise []"),
      min: z.number().nullable().describe("Slider: required lower bound. Number: optional"),
      max: z.number().nullable().describe("Slider: required upper bound. Number: optional"),
      minLabel: z.string().nullable().describe("Slider: label for the low end"),
      maxLabel: z.string().nullable().describe("Slider: label for the high end"),
      unit: z.string().nullable().describe("Number: unit such as 'hours/week'"),
    }),
  ),
});

export const followupOutputSchema = z.object({
  reply: z
    .string()
    .describe("Your next message to the user: one clarifying question, or a closing line"),
  done: z.boolean().describe("true when you have enough information to rate the user"),
});
