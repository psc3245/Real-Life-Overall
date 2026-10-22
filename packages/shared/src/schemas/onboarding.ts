import { z } from "zod";
import type { Answers, ChatMessageDto, QuestionDto } from "./questionnaire";
import {
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
} from "../constants";

export const ONBOARDING_STAGES = [
  "discovery",
  "tree",
  "weights",
  "questionnaire",
  "followup",
  "rating",
  "complete",
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

const importance = z.number().int().min(IMPORTANCE_MIN).max(IMPORTANCE_MAX);

export interface RatingNodeDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  depth: number;
  weight: number;
  sortOrder: number;
  templateKey: string | null;
}

export interface SeasonDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  status: "setup" | "active" | "archived";
}

export interface OnboardingStateDto {
  stage: OnboardingStage;
  season: SeasonDto;
  priorities: string | null;
  weightRationale: string | null;
  /** The discovery conversation; `done` once the scout has enough to draft a tree. */
  discovery: { messages: ChatMessageDto[]; done: boolean };
  /** Why the scout drafted the tree it did, shown on the build step. */
  templateRationale: string | null;
  /** Includes the Overall root (parentId null). Empty until the tree is first saved. */
  nodes: RatingNodeDto[];
  /** Null until generated; once it exists the tree and weights are locked. */
  questionnaire: QuestionDto[] | null;
  answers: Answers;
  chat: ChatMessageDto[];
}

// Request bodies

export const suggestAttributesBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_NODE_NAME_LENGTH),
  description: z.string().trim().max(MAX_NODE_DESCRIPTION_LENGTH).default(""),
  existing: z.array(z.string().max(MAX_NODE_NAME_LENGTH)).max(20).default([]),
});

export const suggestWeightsBodySchema = z.object({
  priorities: z.string().trim().max(1000).default(""),
});

export const saveWeightsBodySchema = z.object({
  weights: z
    .array(z.object({ nodeId: z.uuid(), weight: importance }))
    .min(1)
    .max(100),
});

// Responses

export interface AttributeSuggestionDto {
  name: string;
  description: string;
}

export interface WeightSuggestionDto {
  weights: { nodeId: string; weight: number }[];
  rationale: string;
}

// LLM outputs. Every field is required (nullable where optional) so the schemas work with
// providers' strict structured-output modes.

export const attributeSuggestionOutputSchema = z.object({
  attributes: z
    .array(
      z.object({
        name: z.string().describe(`Short attribute name, at most ${MAX_NODE_NAME_LENGTH} chars`),
        description: z.string().describe("One short sentence describing what it measures"),
      }),
    )
    .describe("3 to 5 attributes"),
});

export const weightSuggestionOutputSchema = z.object({
  weights: z.array(
    z.object({
      ref: z.string().describe("The node ref exactly as given, e.g. n3"),
      importance: z.number().describe("Integer 1-10, relative to the node's siblings"),
    }),
  ),
  rationale: z.string().describe("2-4 neutral sentences explaining the weighting"),
});

// Discovery (DESIGN.md §5.1): a short conversation, then an AI-drafted tree.

export const MAX_DISCOVERY_TURNS = 8;
/** User answers needed before a template can be drafted. */
export const MIN_DISCOVERY_ANSWERS = 2;

export const discoveryOutputSchema = z.object({
  reply: z.string().describe("Your next message: one question, or a short wrap-up when done"),
  done: z.boolean().describe("true once you know enough to draft their rating tree"),
});

const templateLeaf = z.object({
  name: z.string().describe(`Short attribute name, at most ${MAX_NODE_NAME_LENGTH} chars`),
  description: z.string().describe("One short sentence on what it measures"),
  weight: z.number().describe("Importance among its siblings, 1-10"),
});

export const templateOutputSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        weight: z.number().describe("Importance among categories, 1-10"),
        templateKey: z
          .string()
          .nullable()
          .describe("The matching starter category key if it is one of them, else null"),
        attributes: z
          .array(
            templateLeaf.extend({
              subAttributes: z
                .array(templateLeaf)
                .describe("Usually []; only when the user cares about finer detail here"),
            }),
          )
          .describe("2-5 attributes"),
      }),
    )
    .describe("3-7 categories covering what matters to this user"),
  rationale: z.string().describe("2-4 sentences to the user on why this shape and these weights"),
  priorities: z
    .string()
    .describe("A compact summary of the user's goals and what matters to them, for later steps"),
});
